import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { FreeplayService } from '../services/freeplay';
import { AuthService } from '../services/auth';
import { Validator } from '../validators/base';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { FreeplayFinish, UpdateUserFreeplayFinishRules } from '../validators/freeplay';

export const finishingFreeplay: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection        = await new Database().getConnection();
    const freeplayService   = new FreeplayService(connection);
    const authService       = new AuthService(connection);
    const userService       = authService.userService;
    const gameId            = event.pathParameters?.gameId;

    if (!gameId || isNaN(Number(gameId))) return ResponseService.baseResponseJson(422, 'Please insert valid gameId', {});

    let parsedBody: FreeplayFinish;
    try {
        parsedBody = JSON.parse(`${event.body}`);
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }

    const validate = await new Validator(UpdateUserFreeplayFinishRules).validate(parsedBody);
    if (!validate.status) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
    }

    const rawToken = event.headers.Authorization;
    const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
    if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

    const response = await freeplayService.finishingUserFreeplay(user, Number(gameId), parsedBody);
    return ResponseService.baseResponseJson(200, "Request processed successfully", response);
}

// exports.finishingFreeplay    = new MiddlewareWrapper().init(finishingFreeplay, [checkBannedMiddleware()]);