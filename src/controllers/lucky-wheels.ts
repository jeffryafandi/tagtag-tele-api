import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { AuthService } from '../services/auth';
import { DailyLoginService } from '../services/daily-login';
import { UserService } from '../services/user';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { LuckyWheelsService } from '../services/lucky-wheels';
import { UserRequestService } from '../services/user-request';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { checkForceUpdateMiddleware } from '../middleware/check-force-update';
import { checkXApiSecretMiddleware } from '../middleware/check-x-api-secret';
import { MiddlewareWrapper } from '../middleware';
import { HelperService } from '../services/helper';

export const getLuckyWheels: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const luckyWheelsService  = new LuckyWheelsService(connection);   
        const authService         = new AuthService(connection);   
        const userService         = new UserService(connection);   

        // Get Logged User
        let user = null;
        let rawToken = event.headers.Authorization;
        if(rawToken != undefined){
            let token = authService.sanitizeRawToken(rawToken);
            user = await userService.getUserByApiToken(token);
        }

        if(user == null){
            return ResponseService.baseResponseJson(401, 'Token is invalid.', null);
        }
        // End Get Logged User

        let luckyWheelsList = await luckyWheelsService.getLuckyWheels(user);
        return ResponseService.baseResponseJson(200, 'Data fetched successfully', luckyWheelsList);
    });
}

export const luckyWheelSpin: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const luckyWheelsService    = new LuckyWheelsService(connection);   
        const authService           = new AuthService(connection);   
        const userService           = new UserService(connection);   
        const userRequestService    = new UserRequestService(connection);

        // Get Logged User
        let user = null;
        let rawToken = event.headers.Authorization;
        if(rawToken != undefined){
            let token = authService.sanitizeRawToken(rawToken);
            user = await userService.getUserByApiToken(token);
        }

        if(user == null){
            return ResponseService.baseResponseJson(401, 'Token is invalid.', null);
        }

        const isRequestAllowed = await userRequestService.validateAndStoreUserRequest(event, user.id);
        if (!isRequestAllowed) {
            return ResponseService.baseResponseJson(429, 'Too many Request!', null);
        }
        // End Get Logged User

        let spin = await luckyWheelsService.luckyWheelSpin(user);
        
        return ResponseService.baseResponseJson(200, 'Request processed successfully', spin);
    });
}

export const resetSpinEntries: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const luckyWheelsService    = new LuckyWheelsService(connection);   
        const authService           = new AuthService(connection);
        const user                  = await authService.getUserFromToken(`${event.headers.Authorization}`);
        const userRequestService    = new UserRequestService(connection);

        if (!user) {
            return ResponseService.baseResponseJson(422, 'User not found', null);
        }

        const isRequestAllowed      = await userRequestService.validateAndStoreUserRequest(event, user.id);
        if (!isRequestAllowed) {
            return ResponseService.baseResponseJson(429, 'Too many Request!', null);
        }

        const reset = await luckyWheelsService.resetUserSpinEntries(user);
        if (!reset) {
            return ResponseService.baseResponseJson(422, 'User still have spin_entries', null);
        }
        
        return ResponseService.baseResponseJson(200, 'Request processed successfully', null);
    });
}

// exports.luckyWheelSpin      = new MiddlewareWrapper().init(luckyWheelSpin, [checkBannedMiddleware(),checkForceUpdateMiddleware(),checkXApiSecretMiddleware()]);
// exports.resetSpinEntries    = new MiddlewareWrapper().init(resetSpinEntries, [checkBannedMiddleware(),checkForceUpdateMiddleware(),checkXApiSecretMiddleware()]);
