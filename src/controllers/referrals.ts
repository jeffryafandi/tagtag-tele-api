import * as lambda from 'aws-lambda';
import { BaseResponse } from '../interfaces/generals/response';
import { AuthService } from '../services/auth';
import { ReferralService } from '../services/referral';
import { ResponseService } from '../services/response';
import { UserService } from '../services/user';
import { Database } from '../database';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';

export const userClaim: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection        = await new Database().getConnection();
    const referralService   = new ReferralService(connection);
    const userService       = new UserService(connection);
    const authService       = new AuthService(connection);
    const rawToken          = event.headers.Authorization;
    const user              = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

    if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

    await referralService.claimUserReferrals(user.id);
    return ResponseService.baseResponseJson(200, 'Referral Prizes Claimed Successfully!', {})
}

// exports.userClaim = new MiddlewareWrapper().init(userClaim, [checkBannedMiddleware()]);