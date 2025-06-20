import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { AppConfigService } from '../services/app-config';
import { AuthService } from '../services/auth';
import { UserService } from '../services/user';
import { MiddlewareWrapper } from '../middleware';
import { HelperService } from '../services/helper';

export const getApplicationConfigurations: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const appConfig     = new AppConfigService(connection);
        const authService   = new AuthService(connection);
        const userService   = new UserService(connection);
        const data          = await appConfig.mapAppConfig();
        const dataTrue      = await appConfig.mapAppConfigIsPublic();
        // Get Logged User
        let user = null;
        const rawToken = event.headers.Authorization;
        if(rawToken != undefined){
            const token = authService.sanitizeRawToken(rawToken);
    
            user = await userService.getUserByApiToken(token);
        }
    
        if(user == null){
            return ResponseService.baseResponseJson(401, 'Token is invalid.', dataTrue);
        }
        // End Get Logged User
        return ResponseService.baseResponseJson(200, 'Data fetched successfully', data);
    });
}

// exports.getApplicationConfigurations = new MiddlewareWrapper().init(getApplicationConfigurations, []);