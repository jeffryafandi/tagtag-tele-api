import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { QuestService } from '../services/quest';
import { AuthService } from '../services/auth';
import { QuestProgress, UpdateUserQuestProgressRules } from '../validators/quest';
import { Validator } from '../validators/base';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { checkForceUpdateMiddleware } from '../middleware/check-force-update';
import { checkXApiSecretMiddleware } from '../middleware/check-x-api-secret';
import { HelperService } from '../services/helper';

export const getQuestStatus: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const questService      = new QuestService(connection);
        const authService       = new AuthService(connection);
        const userService       = authService.userService;
        const questId           = event.pathParameters?.questId;
        const rewardMultiplier  = event.queryStringParameters?.reward_multiplier || 1;

        if (!questId || isNaN(Number(questId))) return ResponseService.baseResponseJson(422, 'Please insert valid questId', {});

        const rawToken = event.headers.Authorization;
        const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        const userQuestStatus = await questService.getUserQuestStatus(user, Number(questId), Number(rewardMultiplier));
        return ResponseService.baseResponseJson(200, 'Data fetched successfully', userQuestStatus);
    });
}

export const finishingQuest: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const questService  = new QuestService(connection);
        const authService   = new AuthService(connection);
        const userService   = authService.userService;
        const questId       = event.pathParameters?.questId;

        if (!questId || isNaN(Number(questId))) return ResponseService.baseResponseJson(422, 'Please insert valid questId', {});

        let parsedBody: QuestProgress;
        try {
            parsedBody = JSON.parse(`${event.body}`);
        } catch (error) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
        }

        const validate = await new Validator(UpdateUserQuestProgressRules).validate(parsedBody);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const rawToken = event.headers.Authorization;
        const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        const response = await questService.finishingUserQuestId(user, Number(questId), parsedBody);
        return ResponseService.baseResponseJson(200, "Request processed successfully", response);
    } catch (error: any) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something wrong with the finishingQuest request', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const startingQuest: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const questService      = new QuestService(connection);
        const authService       = new AuthService(connection);
        const questId           = event.pathParameters?.questId;
        
        if (!questId || isNaN(Number(questId))) return ResponseService.baseResponseJson(422, 'Please insert valid questId', {});
        
        const rawToken  = event.headers.Authorization;
        const user      = await authService.getUserFromToken(authService.sanitizeRawToken(`${rawToken}`));
        
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        await questService.startUserQuest(user, Number(questId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", {});
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Something wrong with the startingQuest request', {error: JSON.stringify(error)});
    }
}

export const userClaimCompleteQuest: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const questService  = new QuestService(connection);
        const authService   = new AuthService(connection);
        const rawToken      = event.headers.Authorization;
        const user          = await authService.getUserFromToken(authService.sanitizeRawToken(`${rawToken}`));
        
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        await questService.claimCompletedQuest(user);
        return ResponseService.baseResponseJson(200, "Request processed successfully", {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const adQuestViewConfirmation: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const questService      = new QuestService(connection);
        const authService       = new AuthService(connection);
        const questId           = event.pathParameters?.questId;
        
        if (!questId || isNaN(Number(questId))) return ResponseService.baseResponseJson(422, 'Please insert valid questId', {});
        
        const rawToken  = event.headers.Authorization;
        const user      = await authService.getUserFromToken(authService.sanitizeRawToken(`${rawToken}`));
        
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        await questService.adQuestViewConfirmation(user, Number(questId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", {});
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Something wrong with the adQuestViewConfirmation request', {error: JSON.stringify(error)});
    }
}

// exports.getQuestStatus          = new MiddlewareWrapper().init(getQuestStatus, [checkBannedMiddleware()]);
// exports.finishingQuest          = new MiddlewareWrapper().init(finishingQuest, [checkBannedMiddleware(),checkForceUpdateMiddleware(),checkXApiSecretMiddleware()]);
// exports.startingQuest           = new MiddlewareWrapper().init(startingQuest, [checkBannedMiddleware()]);
// exports.userClaimCompleteQuest  = new MiddlewareWrapper().init(userClaimCompleteQuest, [checkBannedMiddleware()]);
// exports.adQuestViewConfirmation      = new MiddlewareWrapper().init(adQuestViewConfirmation, [checkBannedMiddleware()]);