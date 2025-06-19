import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { MissionService } from '../services/mission';
import { AuthService } from '../services/auth';
import { UpdateUserMissionProgressRules } from '../validators/mission';
import { Validator } from '../validators/base';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { checkForceUpdateMiddleware } from '../middleware/check-force-update';
import { checkXApiSecretMiddleware } from '../middleware/check-x-api-secret';
import { HelperService } from '../services/helper';

export const getMissionStatus: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const missionService    = new MissionService(connection);
            const authService       = new AuthService(connection);
            const userService       = authService.userService;
            const missionId         = event.pathParameters?.missionId;
            const rewardMultiplier  = event.queryStringParameters?.reward_multiplier || 1;
    
            if (!missionId || isNaN(Number(missionId))) return ResponseService.baseResponseJson(422, 'Please insert valid missionId', {});
    
            const rawToken = event.headers.Authorization;
            const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
    
            if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
            
            const userMissionStatus = await missionService.getUserMissionStatus(user, Number(missionId), Number(rewardMultiplier));
            return ResponseService.baseResponseJson(200, 'Data fetched successfully', userMissionStatus);
        } catch (error) {
            console.log(error);
            return ResponseService.baseResponseJson(422, 'Something wrong with getMissionStatus', {error: JSON.stringify(error)});
        }
    });
}

export const userMissionHandler: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const handlers  = {
            'finish'            : finishingMission,
            'claim-completion'  : userClaimCompleteGameMission
        } as any;
        const apiPath   = event.pathParameters;
    
        if (apiPath && apiPath.action) {
            if (!['finish', 'claim-completion'].includes(apiPath.action)) throw Error('Invalid action it should be between `claim-completion` and `finish`')
            if (Object.keys(handlers).includes(apiPath.action)) {
                return await handlers[apiPath.action](event);
            }
        }
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)})
    }
}

const finishingMission: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        let parsedBody: any;
        const connection        = await new Database().getConnection();
        const missionService    = new MissionService(connection);
        const authService       = new AuthService(connection);
        const userService       = authService.userService;
        const missionId         = event.pathParameters?.missionId;
        
        if (!missionId || isNaN(Number(missionId))) return ResponseService.baseResponseJson(422, 'Please insert valid missionId', {});
        
        try {
            parsedBody = JSON.parse(`${event.body}`);
        } catch (error) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
        }

        const validate = await new Validator(UpdateUserMissionProgressRules).validate(parsedBody);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const rawToken = event.headers.Authorization;
        const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        const response = await missionService.finishingUserMission(user, Number(missionId), parsedBody);
        return ResponseService.baseResponseJson(200, "Request processed successfully", response);
    } catch (error) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something wrong with the finishingMission request', {error: JSON.stringify(error)});
    }
}

export const startingMission: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const missionService    = new MissionService(connection);
        const authService       = new AuthService(connection);
        const missionId         = event.pathParameters?.missionId;
        
        if (!missionId || isNaN(Number(missionId))) return ResponseService.baseResponseJson(422, 'Please insert valid missionId', {});
        
        const rawToken  = event.headers.Authorization;
        const user      = await authService.getUserFromToken(authService.sanitizeRawToken(`${rawToken}`));
        
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        await missionService.startUserMission(user, Number(missionId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", {});
    } catch (error) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something wrong with the startingMission request', {error: JSON.stringify(error)});
    }
}

const userClaimCompleteGameMission: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const connection        = await new Database().getConnection();
        const missionService    = new MissionService(connection);
        const authService       = new AuthService(connection);
        const rawToken          = event.headers.Authorization;
        const user              = await authService.getUserFromToken(authService.sanitizeRawToken(`${rawToken}`));
        const missionId         = event.pathParameters?.missionId;
        
        if (!missionId || isNaN(Number(missionId))) return ResponseService.baseResponseJson(422, 'Please insert valid missionId', {});
        
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        await missionService.claimCompletedMission(user, Number(missionId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const adMissionViewConfirmation: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const missionService    = new MissionService(connection);
        const authService       = new AuthService(connection);
        const missionId         = event.pathParameters?.missionId;
        
        if (!missionId || isNaN(Number(missionId))) return ResponseService.baseResponseJson(422, 'Please insert valid missionId', {});
        
        const rawToken  = event.headers.Authorization;
        const user      = await authService.getUserFromToken(authService.sanitizeRawToken(`${rawToken}`));
        
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        await missionService.adMissionViewConfirmation(user, Number(missionId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", {});
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Something wrong with the adMissionViewConfirmation request', {error: JSON.stringify(error)});
    }
}

export const resetMission: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const missionService    = new MissionService(connection);
        const authService       = new AuthService(connection);
        const userService       = authService.userService;
        const missionId         = event.pathParameters?.missionId;

        if (!missionId || isNaN(Number(missionId))) return ResponseService.baseResponseJson(422, 'Please insert valid missionId', {});

        const rawToken = event.headers.Authorization;
        const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        const response = await missionService.resetMissionById(user, Number(missionId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", response);
    } catch (error) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something wrong with the resetMission request', {error: JSON.stringify(error)});
    }
}

// exports.getMissionStatus            = new MiddlewareWrapper().init(getMissionStatus, [checkBannedMiddleware()]);
exports.finishingMission            = new MiddlewareWrapper().init(finishingMission, [checkBannedMiddleware(),checkForceUpdateMiddleware(),checkXApiSecretMiddleware()]);
// exports.startingMission             = new MiddlewareWrapper().init(startingMission, [checkBannedMiddleware()]);
exports.userClaimCompleteGameMission= new MiddlewareWrapper().init(userClaimCompleteGameMission, [checkBannedMiddleware()]);
// exports.userMissionHandler          = new MiddlewareWrapper().init(userMissionHandler, [checkBannedMiddleware(),checkForceUpdateMiddleware(),checkXApiSecretMiddleware()]);
// exports.adMissionViewConfirmation     = new MiddlewareWrapper().init(adMissionViewConfirmation, [checkBannedMiddleware()]);