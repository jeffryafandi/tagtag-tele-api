import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { OperatorService } from '../services/operator';
import { AuthService } from '../services/auth';
import { Validator } from '../validators/base';
import { OperatorCheckBillingRules, UserPayOperatorBillRules } from '../validators/operator';
import { Connection } from 'typeorm';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { HelperService } from '../services/helper';

const initService = async (): Promise<[Connection, OperatorService, AuthService]> => {
    const connection        = await new Database().getConnection();
    const operatorService   = new OperatorService(connection);
    const authService       = new AuthService(connection);

    return [connection, operatorService, authService];
}

export const getOperatorsProducts: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const operatorService   = new OperatorService(connection);
        const params            = event.queryStringParameters;
        const data              = await operatorService.mapOperatorData({group_name: params?.group_name, vendor: params?.vendor});

        return ResponseService.baseResponseJson(200, "Data fetched successfully", data);
    });
}

export const operatorCheckBilling: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const [connection, operatorService, authService] = await initService();
    try {
        if (!event.body) return ResponseService.baseResponseJson(422, 'Payload cannot empty', {});

        const parsedBody= JSON.parse(`${event.body}`);
        const validate  = await new Validator(OperatorCheckBillingRules).validate(parsedBody);

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const checkBilling = await operatorService.checkAccountBilling(parsedBody);

        return ResponseService.baseResponseJson(checkBilling.success ? 200 : 422, `Request is ${checkBilling.success ? 'success' : 'failed'}`, {
            success: checkBilling.success,
            billing_amount: checkBilling.data.amount
        });
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)})
    }
}

export const purchasedByUser: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const [connection, operatorService, authService] = await initService();
    try {
        if (!event.body) return ResponseService.baseResponseJson(422, 'Payload cannot empty', {});
        const parsedBody= JSON.parse(`${event.body}`);
        const validate  = await new Validator(UserPayOperatorBillRules).validate(parsedBody);

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const user = await authService.getUserFromToken(`${event.headers.Authorization}`);

        if (!user) throw Error('User is not found!');
        
        // check pin
        const checkPin = await authService.checkIsPinAuthenticated(user, parsedBody.pin);
        if (!checkPin.is_valid) {
            return ResponseService.baseResponseJson(422, 'PIN is Invalid', { error: true });
        }

        if (!checkPin.userPin) {
            return ResponseService.baseResponseJson(422, 'User doesn\'t have pin', { error: true })
        }

        const userPaid = await operatorService.userPayBilling(user, parsedBody);
        return ResponseService.baseResponseJson(userPaid ? 200 : 422, userPaid ? 'Purchase Succesfully' : 'Purchase is failed', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)})
    }
}

// exports.operatorCheckBilling    = new MiddlewareWrapper().init(operatorCheckBilling, [checkBannedMiddleware()]);
// exports.purchasedByUser         = new MiddlewareWrapper().init(purchasedByUser, [checkBannedMiddleware()]);