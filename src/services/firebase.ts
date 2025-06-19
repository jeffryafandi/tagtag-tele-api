import { JWT } from "google-auth-library";
import { BaseService } from "./base";
import { HelperService } from "./helper";
import { BaseFirebaseMessageRequest, BaseNotificationDataType, BaseNotificationData } from "../interfaces/requests/firebase";
import { NotificationQueueDataRequest } from "../interfaces/requests/notification";
import { Connection, DeepPartial } from "typeorm";
import { FCMLogs } from "../entities/fcm-logs";
import { ALLOW_NOTIF_CONFIG_KEY } from "../config/constants";
import { AppConfigService } from "./app-config";

export class FirebaseService extends BaseService {
    private accessToken     ?: string|null;
    private credFiles       : any;
    private appConfigService: AppConfigService;
    /**
     * @todo: Make function to remove invalid tokens
     * https://firebase.google.com/docs/cloud-messaging/manage-tokens#detect-invalid-token-responses-from-the-fcm-backend
     */

    constructor(dbConn: Connection) {
        super(dbConn);
        this.credFiles          = require('../../google_service_account.json');
        this.appConfigService   = new AppConfigService(dbConn);
    }

    public async getAccessToken() {
        if (!this?.accessToken) {
            const jwtClient = new JWT(
                process.env.FCM_CLIENT_EMAIL,
                undefined,
                this.credFiles.private_key,
                ['https://www.googleapis.com/auth/firebase.messaging'],
                undefined
            );
            
            const getToken  = await jwtClient.authorize();
            this.accessToken= getToken.access_token;
        }
    
        return this.accessToken;
    }

    public generateMessage(token: string, notification: BaseNotificationData, data: BaseNotificationDataType | undefined = undefined): BaseFirebaseMessageRequest {
        return {
            notification,
            token,
            data,
            android: {
                direct_boot_ok: true
            }
        }
    }

    public generateBatchMessage(tokens: string[], notification: BaseNotificationData, data: BaseNotificationDataType | undefined = undefined):  BaseFirebaseMessageRequest[] {
        return tokens.map((token) => this.generateMessage(token, notification, data));
    }

    public async storeToFCMLogs(payload: DeepPartial<FCMLogs>): Promise<FCMLogs> {
        return await this.dbConn.getRepository(FCMLogs).save(payload);
    }


    public async sendNotification(token: string, notification: BaseNotificationData, data: BaseNotificationDataType | undefined = undefined, internalRequest: NotificationQueueDataRequest) {
        await this.getAccessToken();
        const baseUrl       = `${process.env.FCM_API_URL}${process.env.FCM_PROJECT_ID}${process.env.FCM_SEND_ENDPOINT}`;
        const message       = this.generateMessage(token, notification, data);
        const bodyPayload   = { message };
        const headers       = [
            ["Authorization", `Bearer ${this.accessToken}`]
        ];

        const shouldLog     = process.env.ENABLE_FCM_LOGS ?? '0';
 
        // get from app_configs allow_send_notif
        const appConfig     = await this.appConfigService.getConfigByKey(ALLOW_NOTIF_CONFIG_KEY);
        let isNotifAllowed  = false;
        if (appConfig) {
            isNotifAllowed  = Boolean(appConfig.config_value);
        }

        if (isNotifAllowed) {
            const response = await this.helperService.post(baseUrl, bodyPayload, headers);
            if (Number(shouldLog)) {
                await this.storeToFCMLogs({
                    payload: JSON.stringify({
                        internal_request: internalRequest,
                        fcm             : bodyPayload
                    }),
                    data: JSON.stringify(response.parsedBody || {})
                });
            }
    
            return response;
        }

        return {parsedBody: {name: `Skipping sending notif to ${token}`}};
    }
}