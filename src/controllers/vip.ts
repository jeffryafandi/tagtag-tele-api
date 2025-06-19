import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { VipService } from '../services/vip';
import { AuthService } from '../services/auth';
import { QuestProgress, UpdateUserQuestProgressRules } from '../validators/quest';
import { Validator } from '../validators/base';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { checkForceUpdateMiddleware } from '../middleware/check-force-update';
import { checkXApiSecretMiddleware } from '../middleware/check-x-api-secret';
import { HelperService } from '../services/helper';

export const getVipRewards: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const authService   = new AuthService(connection);
        const vipService    = new VipService(connection);
        const userService   = authService.userService;
        const rawToken      = event.headers.Authorization;
        const user          = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
        const quests = await vipService.getVipRewards(user);
        return ResponseService.baseResponseJson(200, "Data fetched successfully", quests);
    });
}

export const getVipQuests: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const authService   = new AuthService(connection);
        const vipService    = new VipService(connection);
        const userService   = authService.userService;
        const rawToken      = event.headers.Authorization;
        const user          = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
        const quests = await vipService.getVipQuest(user);
        return ResponseService.baseResponseJson(200, "Data fetched successfully", quests);
    });
}

export const finishingVipQuest: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const vipService    = new VipService(connection);
        const authService   = new AuthService(connection);
        const userService   = authService.userService;
        const questId       = event.pathParameters?.questId;

        if (!questId || isNaN(Number(questId))) return ResponseService.baseResponseJson(422, 'Please insert valid questId', {});

        const rawToken = event.headers.Authorization;
        const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        const response = await vipService.finishingUserVipQuestId(user, Number(questId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", response);
    } catch (error: any) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something wrong with the finishingQuest request', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}