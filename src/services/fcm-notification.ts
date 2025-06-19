import { Brackets, Connection } from "typeorm";
import { BaseService } from "./base";
import { FirebaseService } from "./firebase";
// import { FcmNotifications } from "../entities/fcm-notifications";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import dayjs from "dayjs";
import { BaseNotificationData } from "../interfaces/requests/firebase";
import { NOTIF_CODE } from "../config/notif-constant";
import { Users } from "../entities/users";
import { UserService } from "./user";
import { QUEUE_TYPE } from "../config/queue-constant";
import { MESSAGE_CHUNK_SIZE } from "../config/constants";
import { PrizepoolService } from "./prizepool";
import { NotifMessageQueueRequest, NotificationQueueDataRequest, NotificationQueueRequest } from "../interfaces/requests/notification";
import { UserDevices } from "../entities/user-devices";
import { AvailableWithdrawCurrency } from "../interfaces/requests/users";
import { FcmNotifications } from "../entities/fcm-notifications";
import { SQSService } from "./aws/sqs";

export class NotificationService extends BaseService {
    private firebaseService : FirebaseService;
    private userService     : UserService;
    private sqsService      : SQSService;

    constructor(connection: Connection) {
        super(connection);
        this.firebaseService    = new FirebaseService(connection);
        this.userService        = new UserService(connection);
        this.sqsService         = new SQSService();
    }
    public async fetchNotifByCode(code: string): Promise<FcmNotifications|null> {
        return await this.dbConn.getRepository(FcmNotifications).findOne({where: {code: code}});
    }

    public async fetchNotifById(notifId: number): Promise<FcmNotifications|null> {
        return await this.dbConn.getRepository(FcmNotifications).findOne({where: {id: notifId}});
    }

    public async update(notification: FcmNotifications, schema: QueryDeepPartialEntity<FcmNotifications>) {
        await this.dbConn.getRepository(FcmNotifications).update(notification.id, schema)
    }

    public async send(tokens: string[], fcmPayload: BaseNotificationData, data: any = {}, notification: NotificationQueueDataRequest): Promise<Array<string>> {
        let invalidTokens = [];
        for (const token of tokens) {
            try {
                const response: any = await this.firebaseService.sendNotification(token, fcmPayload, data, notification);
                console.log(`Success sendin notif with messageID: ${response.parsedBody?.name}`);
            } catch (error) {
                console.log("ERROR", error, token);
                invalidTokens.push(token);
            }
        }
        return invalidTokens;
    }

    public async sendNotificationByCode(notifCode: string, parameters: Record<string, any> = {}, to: 'all' | string[] = 'all') {
        const notification  = await this.fetchNotifByCode(notifCode);
        if (notification) {
            await this.sendNotificationQueue(notification, parameters, to);
        }
    }

    public async getAllPeriodicFcmNotifications(): Promise<FcmNotifications[]> {
        const today = dayjs().format();

        return await this.dbConn.getRepository(FcmNotifications)
        .createQueryBuilder()
        .where('is_periodic=1')
        .andWhere(new Brackets((qb) => {
            qb.where('published_at is NULL')
            .orWhere('published_at < :today', {today})
        }))
        .getMany();
    }

    public async handleNotifMessageQueue(messages: NotifMessageQueueRequest[]) {
        let invalidTokens = [];
        for (const message of messages) {
            const tokens = await this.send([message.token], message.message, message.data, message.notification);
            invalidTokens.push(tokens);
        }

        for (const tokens of invalidTokens) {
            try {
                if (tokens.length) {
                    await this.userService.deleteUserDevicesByTokens(tokens);
                }
                console.log("SKIPPING DELETE TOKENS, BECAUSE EMPTY!");
            } catch (error) {
                console.error("CANNOT DELETE TOKENS", error);
            }
        }

        return true;
    }

    public generatePurchaseBodyData(groupName: string, status: string): string {
        let itemName = '';
        switch (groupName) {
            case 'pln':
                itemName = `Voucher Listrik`;
                break;
            case 'pam':
                itemName = `Tagihan PDAM`;
                break;
        
            default:
                itemName = `Pulsa ${this.helperService.ucFirst(groupName)}`;
                break;
        }
        return `${groupName === 'pam' ? 'Pembayaran' : 'Pembelian'} ${itemName} kamu sebesar [nominal] ${status == 'success' ? 'sudah sukses' : 'gagal'}`
    }

    public generateWithdrawBodyData(code: string, status: string): {message: string, currency: AvailableWithdrawCurrency} {
        let itemName = [NOTIF_CODE.WITHDRAW_COIN_FAIL, NOTIF_CODE.WITHDRAW_COIN_SUCCESS].includes(code) ? 'Koin' : 'Komisi';
        return {
            message : `Penarikan ${itemName} kamu sebesar [nominal] ${status == 'success' ? 'sudah berhasil!' : 'gagal!'}`,
            currency: (itemName == 'Koin') ? AvailableWithdrawCurrency.coin : AvailableWithdrawCurrency.revenue
        }
    }
    
    public generateWithdrawNotifData(notification: FcmNotifications, parameters: any) {
        const status                = this.isWithdrawNotif(notification, true) ? 'success' : 'failed';
        const {message, currency}   = this.generateWithdrawBodyData(notification.code, status);
        let dataQuery: any  = {
            from    : 'withdraw',
            status,
            nominal : parameters.nominal,
            body    : message,
            currency
        }
        return {
            appLink: `${process.env.BASE_APPLINK}/notification?${this.helperService.createQueryString(dataQuery)}`,
        }
    }

    public isPrizepoolNotif(notification: FcmNotifications) {
        return notification.code === NOTIF_CODE.PRIZEPOOL_TOTAL
    }

    public isPurchaseNotif(notification: FcmNotifications) {
        return [
            NOTIF_CODE.PURCHASE_MOBILE_SUCCESS,
            NOTIF_CODE.PURCHASE_MOBILE_FAIL,
            NOTIF_CODE.PURCHASE_PAM_FAIL,
            NOTIF_CODE.PURCHASE_PAM_SUCCESS,
            NOTIF_CODE.PURCHASE_PLN_FAIL,
            NOTIF_CODE.PURCHASE_PLN_SUCCESS
        ].includes(notification.code);
    }

    public isWithdrawNotif(notification: FcmNotifications, onlySuccess: boolean = false) {
        const baseCodes = [
            NOTIF_CODE.WITHDRAW_COIN_SUCCESS,
            NOTIF_CODE.WITHDRAW_REVENUE_SUCCESS,
        ];
        if (!onlySuccess) {
            baseCodes.push(...[
                NOTIF_CODE.WITHDRAW_COIN_FAIL,
                NOTIF_CODE.WITHDRAW_REVENUE_FAIL,
            ])
        }
        return baseCodes.includes(notification.code);
    }

    public isPurchaseShopNotif(notification: FcmNotifications) {
        return notification.code === NOTIF_CODE.PURCHASE_SHOP_SUCCESS
    }

    public async handleNotificationQueue(data: NotificationQueueDataRequest) {
        const notification = await this.fetchNotifById(data.notification_id);
        if (!notification) return;

        let notificationTitle   = notification.title;
        let notificationBody    = notification.body;
        let notificationData    = {} as any;
        let deviceTokens        = [] as UserDevices[];

        if (data.to == 'all') {
            deviceTokens = await this.userService.fetchAllUserDeviceTokens();
        } else if (data.to.length > 0) {
            deviceTokens = await this.userService.fetchUserDevicesByUserIDS(data.to);
        }
        
        // update title for notification prizepool
        if (this.isPrizepoolNotif(notification)) {
            const parameters    = data.parameters;
            const totalPool     = Number(parameters?.total_pool|| 0);
            notificationTitle   = notification.title.replace(':total_prizepool', `${totalPool.toLocaleString()}`)
        }

        if (this.isPurchaseShopNotif(notification)) {
            const parameters    = data.parameters;

            const mapString     = {
                ':product_name'         : parameters?.product_name || 'product name',
                ':product_price'        : parameters?.product_price || 0,
                ':order_id'             : parameters?.order_id || 0
            }

            notificationTitle   = this.helperService.replaceAll(notification.title, mapString);
            notificationBody    = this.helperService.replaceAll(notification.body, mapString);
        }

        if (this.isPurchaseNotif(notification)) {
            const status = [
                NOTIF_CODE.PURCHASE_MOBILE_SUCCESS,
                NOTIF_CODE.PURCHASE_PAM_SUCCESS,
                NOTIF_CODE.PURCHASE_PLN_SUCCESS
            ].includes(notification.code) ? 'success' : 'failed';

            const parameters    = data.parameters;
            const groupName     = parameters?.operator?.group_name || 'group name';
            const mapString     = {
                ':operator_denom'       : parameters?.operator?.denom || 0,
                ':operator_group_name'  : groupName,
                ':account_name'         : parameters?.account_name || 'account name',
                ':account_number'       : parameters?.account_number || 'account number'
            }

            notificationTitle   = this.helperService.replaceAll(notification.title, mapString);
            notificationBody    = this.helperService.replaceAll(notification.body, mapString);
            const dataBody      = this.generatePurchaseBodyData(groupName, status);
            let dataQuery: any  = {
                from    : 'purchase',
                status  : status,
                nominal : mapString[":operator_denom"],
                body    : dataBody
            }

            if (status == 'success' && groupName == 'pln') {
                dataQuery = {...dataQuery, pln_token: parameters.pln_token}
            }

            notificationData    = {
                appLink: `${process.env.BASE_APPLINK}/notification?${this.helperService.createQueryString(dataQuery)}`,
            }
        }

        if (this.isWithdrawNotif(notification)) {
            const parameters    = data.parameters;
            const nominal       = Number(parameters?.nominal|| 0);
            notificationTitle   = notification.title.replace(':nominal', `${nominal.toLocaleString()}`);
            notificationBody    = notification.body.replace(':nominal', `${nominal.toLocaleString()}`);
            notificationData    = this.generateWithdrawNotifData(notification, parameters);
        }

        const allMessages: NotifMessageQueueRequest[] = [];

        for (const device of deviceTokens) {
            let message: BaseNotificationData = {
                title   : notificationTitle.replace(':username', device.user ? device.user.username : 'username'),
                body    : notificationBody.replace(':username', device.user ? device.user.username : 'username')
            }

            const messageToSend: NotifMessageQueueRequest = {
                token       : device.token,
                message     : message,
                data        : notificationData,
                notification: data
            }
            allMessages.push(messageToSend);
        }

        const chunked: NotifMessageQueueRequest[][] = [];
        for (let i = 0; i <= allMessages.length; i += MESSAGE_CHUNK_SIZE) {
            const chunk = allMessages.slice(i, i + MESSAGE_CHUNK_SIZE);
            chunked.push(chunk);
        }

        for (const chunk of chunked) {
            await this.sendNotifMessageQueue(chunk)
        }
    }

    public async sendAvailableFcmNotifications() {
        const notifications = await this.getAllPeriodicFcmNotifications();
        console.log("[Sending notification with sendAvailableFcmNotifications()]", notifications)
        for (const notification of notifications) {
            await this.sendNotificationQueue(notification);
        }
    }

    public async sendNotifMessageQueue(chunkedData: NotifMessageQueueRequest[]) {
        const queueUrl = process.env.SQS_MESSAGES_URL || '';
        if (queueUrl) {
            const queueName = queueUrl.split('/')[queueUrl.split('/').length - 1];
    
            const message = {
                type: QUEUE_TYPE.SEND_MESSAGE,
                data: chunkedData
            }
            
            const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
            const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
            const response          = await this.sqsService.sendSQSMessage(queueName, accessKeyId, secretAccessKey, JSON.stringify(message), process.env.AWS_REGION_ENV);
            console.log(`SENDING TO QUEUE ${queueUrl}`, response);
        }
    }

    public async sendNotificationQueue(notification: FcmNotifications, parameters: Record<string, any> = {}, to: 'all' | string[] = 'all') {
        const queueUrl = process.env.SQS_NOTIFICATIONS_URL || '';
        if (queueUrl) {
            const queueName = queueUrl.split('/')[queueUrl.split('/').length - 1];
    
            const message: NotificationQueueRequest = {
                type: QUEUE_TYPE.SEND_NOTIFICATION,
                data: {
                    notification_id: notification.id,
                    parameters,
                    to
                }
            }
            const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
            const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
            const response          = await this.sqsService.sendSQSMessage(queueName, accessKeyId, secretAccessKey, JSON.stringify(message), process.env.AWS_REGION_ENV);
            console.log("SENDING TO QUEUE NOTIF", JSON.stringify(message), response);
        }

        await this.update(notification, {
            published_at: this.helperService.addHours(dayjs().format(), notification.next_trigger)
        });
    }
}
