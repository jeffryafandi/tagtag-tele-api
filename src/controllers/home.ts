import * as lambda from 'aws-lambda';
import { HomeService } from '../services/home';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { Database } from '../database';
import { AuthService } from '../services/auth';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { HelperService } from '../services/helper';

const database = new Database();

export const getHomeBanners: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const banners       = await new HomeService(connection).getHomeBanners(event);

        return ResponseService.baseResponseJson(200, "Data fetched successfully", banners);
    });
}

export const getDailyQuests: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const authService   = new AuthService(connection);
        const userService   = authService.userService;
        const rawToken      = event.headers.Authorization;
        const user          = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
        const quests = await new HomeService(connection).getHomeDailyQuest(user);
        return ResponseService.baseResponseJson(200, "Data fetched successfully", quests);
    });
}

export const getDailyLogin: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const authService   = new AuthService(connection);
        const userService   = authService.userService;
        const rawToken      = event.headers.Authorization;
        const user          = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
        const userId        = user.id;
        const dailyLogins   = await new HomeService(connection).getHomeDailyLogin(userId);
        return ResponseService.baseResponseJson(200, "Data fetched successfully", dailyLogins);
    });
}

export const getHomeCasualGame: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const authService   = new AuthService(connection);
        const userService   = authService.userService;
        const rawToken      = event.headers.Authorization;
        const user          = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
        const userId        = user.id;
        const casualGames   = await new HomeService(connection).getHomeCasualGames(userId);
        return ResponseService.baseResponseJson(200, "Data fetched successfully", casualGames);
    });
}

export const getUserDashboardData: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback) => {
    const handlers  = {
        'daily-quests'        : getDailyQuests,
        'daily-logins'        : getDailyLogin,
        'casual-games'        : getHomeCasualGame,
    } as any;
    const apiPath   = event.pathParameters;
    
    if (apiPath && apiPath.dataType) {
        if (!Object.keys(handlers).includes(apiPath.dataType)) {
            return ResponseService.baseResponseJson(422, `Invalid data type, it should be ${Object.keys(handlers).join(', ')}`, {});
        }
        return await handlers[apiPath.dataType](event);
    }
}

// exports.getUserDashboardData = new MiddlewareWrapper().init(getUserDashboardData, [checkBannedMiddleware()]);
