import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { AuthService } from '../services/auth';
import { Validator } from '../validators/base';
import { AdsLogsPayload, LoggingAdsRules } from '../validators/ads-log';
import { AdsLogService } from '../services/ads-log';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';

export const logging: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const authService   = new AuthService(connection);
        const userService   = authService.userService;
        const adsLogService = new AdsLogService(connection);
        let parsedBody: AdsLogsPayload;

        try {
            parsedBody = JSON.parse(`${event.body}`);
        } catch (error) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
        }

        const validate = await new Validator(LoggingAdsRules).validate(parsedBody);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const rawToken = event.headers.Authorization;
        const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
        await adsLogService.storeAdsLogForUser(user.id, parsedBody);
        return ResponseService.baseResponseJson(200, 'Request processed successfully', {});
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Something went wrong with the logging request', {});
    }
    
}

// exports.logging = new MiddlewareWrapper().init(logging, [checkBannedMiddleware()]);