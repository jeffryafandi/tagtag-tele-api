import * as lambda from 'aws-lambda';
import { DataSource } from 'typeorm';

import { Database } from '../database';

import { BaseResponse } from '../interfaces/generals/response';

import { AuthService } from '../services/auth';
import { ResponseService } from '../services/response';
import { FriendService } from '../services/friend';

import { Validator } from '../validators/base';
import { AuthFriendActionRules, GetAuthFriendListRules } from '../validators/user';
import { AuthFriendActionRequest, FilterFriendStatusEnum, FilterGetAuthFriendRequest, FriendActivityStatusEnum } from '../interfaces/requests/friend';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';

const controllerInit = async (): Promise<{datasource: DataSource, friendService: FriendService, authService: AuthService}> => {
    const datasource    = await new Database().getConnection();
    const authService   = new AuthService(datasource);
    const friendService = new FriendService(datasource);

    return {datasource, friendService, authService};
}

export const authGetFriendList: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const { friendService, authService } = await controllerInit();
        const params: any = event.queryStringParameters || { type: FriendActivityStatusEnum.all, friend_status: FilterFriendStatusEnum.list };

        const user = await authService.getUserFromToken(`${event.headers.Authorization}`);
        if (!user) throw Error('User is not found!');

        const validate = await new Validator(GetAuthFriendListRules).validate(params);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Invalid parameters', {messages: validate.message});
        }

        const friends = await friendService.mapUserFriend(user.id, params);
        return ResponseService.baseResponseJson(200, 'Fetch data Succesfully', friends);
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)})
    }
}

export const authSearchNotFriend: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { friendService, authService } = await controllerInit();
        const params: any = event.queryStringParameters || { type: FriendActivityStatusEnum.all, friend_status: FilterFriendStatusEnum.list };

        const user = await authService.getUserFromToken(`${event.headers.Authorization}`);
        if (!user) throw Error('User is not found!');

        const validate = await new Validator(GetAuthFriendListRules).validate(params);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Invalid parameters', {messages: validate.message});
        }

        const friends = await friendService.getMapNotFriendedUsers(user.id, params);
        return ResponseService.baseResponseJson(200, 'Fetch data Succesfully', friends);
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)})
    }
}

export const authAddFriend: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { friendService, authService } = await controllerInit();
        
        if (!event.body) throw Error('Body payload cannot be empty!');
        const payload: AuthFriendActionRequest = JSON.parse(`${event.body}`);
        
        const user = await authService.getUserFromToken(`${event.headers.Authorization}`);
        if (!user) throw Error('User is not found!');

        const validate = await new Validator(AuthFriendActionRules).validate(payload);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Something Error', {messages: validate.message});
        }

        const addFriend = await friendService.requestFriendForUser(user, payload);
        return ResponseService.baseResponseJson(200, 'Add friend Succesfully', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const authRejectFriend: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { friendService, authService } = await controllerInit();
        
        if (!event.body) throw Error('Body payload cannot be empty!');
        const payload: AuthFriendActionRequest = JSON.parse(`${event.body}`);
        
        const user = await authService.getUserFromToken(`${event.headers.Authorization}`);
        if (!user) throw Error('User is not found!');

        const validate = await new Validator(AuthFriendActionRules).validate(payload);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Invalid payload', {messages: validate.message});
        }

        await friendService.rejectFriendInviteForUser(user, payload);
        return ResponseService.baseResponseJson(200, 'Rejected Succesfully', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const authApproveFriend: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { friendService, authService } = await controllerInit();
        
        if (!event.body) throw Error('Body payload cannot be empty!');
        const payload: AuthFriendActionRequest = JSON.parse(`${event.body}`);
        
        const user = await authService.getUserFromToken(`${event.headers.Authorization}`);
        if (!user) throw Error('User is not found!');

        const validate = await new Validator(AuthFriendActionRules).validate(payload);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Invalid payload', {messages: validate.message});
        }

        await friendService.approveFriendForUser(user, payload);
        return ResponseService.baseResponseJson(200, 'Approved Succesfully', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const authRemoveFriend: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { friendService, authService } = await controllerInit();
        
        if (!event.body) throw Error('Body payload cannot be empty!');
        const payload: AuthFriendActionRequest = JSON.parse(`${event.body}`);
        
        const user = await authService.getUserFromToken(`${event.headers.Authorization}`);
        if (!user) throw Error('User is not found!');

        const validate = await new Validator(AuthFriendActionRules).validate(payload);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Invalid payload', {messages: validate.message});
        }

        await friendService.removeFriendForUser(user, payload);
        return ResponseService.baseResponseJson(200, 'Removed Succesfully', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

// exports.authGetFriendList   = new MiddlewareWrapper().init(authGetFriendList, [checkBannedMiddleware]);
// exports.authSearchNotFriend = new MiddlewareWrapper().init(authSearchNotFriend, [checkBannedMiddleware]);
// exports.authAddFriend       = new MiddlewareWrapper().init(authAddFriend, [checkBannedMiddleware]);
// exports.authRejectFriend    = new MiddlewareWrapper().init(authRejectFriend, [checkBannedMiddleware]);
// exports.authApproveFriend   = new MiddlewareWrapper().init(authApproveFriend, [checkBannedMiddleware]);
// exports.authRemoveFriend    = new MiddlewareWrapper().init(authRemoveFriend, [checkBannedMiddleware]);