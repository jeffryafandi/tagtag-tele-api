import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { AuthService } from '../services/auth';
import { DailyLoginService } from '../services/daily-login';
import { UserService } from '../services/user';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';

export const claim: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const dailyLoginService     = new DailyLoginService(connection);
    const authService           = new AuthService(connection);
    const userService           = new UserService(connection);    
    
    const rawToken = event.headers.Authorization;
    const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

    if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

    await dailyLoginService.userClaimDailyLogin(user);

    return ResponseService.baseResponseJson(200, 'Success', {});
}

// exports.claim = new MiddlewareWrapper().init(claim, [checkBannedMiddleware()]);