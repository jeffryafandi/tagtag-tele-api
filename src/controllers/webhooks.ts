import * as lambda from 'aws-lambda';

import { Database } from '../database';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { OperatorService } from '../services/operator';
import { MidtransService } from '../services/midtrans';
import { InAppPurchaseService } from '../services/in-app-purchase';
import { IN_APP_PURCHASE_STATUS } from '../config/constants';
import { UserService } from '../services/user';

export const awdCallback: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const queryParams   = event.queryStringParameters;
        const ourTrxId      = queryParams?.partner_trxid;
        const isSuccess     = (!queryParams?.result) ? true : false;
        let status          = 'failed';
        if (queryParams && ourTrxId) {
            const connection    = await new Database().getConnection();
            const service       = new OperatorService(connection);
            const response      = await service.handleOperatorPurchaseAWDWebhook(ourTrxId, isSuccess, queryParams?.msg)
            status              = response.status;
        }
    
        return ResponseService.baseResponseJson(200, 'Webhook processed', {status});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Webhook processing failed', {error: JSON.stringify(error)});
    }
}

export const gopayPaymentNotification: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        console.log('=== Gopay Payment Notification Logs ===');
        console.log('Headers:', JSON.stringify(event.headers, null, 2));
        console.log('Body:', JSON.stringify(JSON.parse(event.body || '{}'), null, 2));
        console.log('=====================================');
        
        const connection        = await new Database().getConnection();
        const midtransService   = new MidtransService(connection);
        const inAppService      = new InAppPurchaseService(connection);
        const userService       = new UserService(connection);

        let body = event.body;
        if(body == null){
            return ResponseService.baseResponseJson(422, 'Payload must be filled', null);
        }

        let parsedBody: any;
        try {
            parsedBody = JSON.parse(body);
        } catch (error) {
            console.error(error);
            return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
        }

        // Verifikasi signature
        const isValidSignature = await midtransService.verifyWebhookSignature({
            headers: event.headers,
            body: parsedBody,
            method: event.httpMethod,
            path: event.path
        });

        if (!isValidSignature) {
            return ResponseService.baseResponseJson(401, 'Invalid signature', {});
        }

        const purchase = await inAppService.getPurchaseByToken(parsedBody.originalReferenceNo);
        if (!purchase || purchase.status != IN_APP_PURCHASE_STATUS.PENDING) {
            return ResponseService.baseResponseJson(404, 'Purchase not found', {});
        }

        const user = await userService.getUserById(purchase.user_id)
        if (!user) {
            return ResponseService.baseResponseJson(404, 'User not found', {});
        }

        if(parsedBody.latestTransactionStatus == "00"){
            console.log("storeUserPurchase");
            await inAppService.updateAppPurchase(purchase, {status: IN_APP_PURCHASE_STATUS.PURCHASE})
            await inAppService.storeUserPurchase(user, purchase);
        }

        return ResponseService.baseResponseJson(200, 'Webhook processed successfully', {});
    } catch (error) {
        console.error('Webhook error:', error);
        return ResponseService.baseResponseJson(500, 'Internal server error', {});
    }
};