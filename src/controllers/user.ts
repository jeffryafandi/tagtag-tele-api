import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { UserService } from '../services/user';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { Validator } from '../validators/base';
import { UpdateUser, UpdateVerificationStatusRules } from '../validators/auth';
import { AuthService } from '../services/auth';
import { HelperService } from '../services/helper';
import { UserAnalytic } from '../validators/user';
import dayjs from 'dayjs';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';

export const updateVerificationStatus: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const verificationId = event.pathParameters?.verificationId;
        if (!verificationId || isNaN(Number(verificationId))) throw Error('invalid verificationID');

        const parsedBody    = JSON.parse(`${event.body}`);
        const validate      = await new Validator(UpdateVerificationStatusRules).validate(parsedBody);

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, validate.message, null);
        }

        const connection    = await new Database().getConnection();
        const userService   = new UserService(connection);
        const updated       = await userService.updateUserVerification({
            verification_id : Number(verificationId), 
            status          : parsedBody.status 
        });

        if (!updated) return ResponseService.baseResponseJson(422, 'Update verification failed!', {});

        return ResponseService.baseResponseJson(200, 'Success', {})
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

const updateUserById: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const userId = event.pathParameters?.userId;
        if (!userId || isNaN(Number(userId))) throw Error('invalid userId');

        const parsedBody    = JSON.parse(`${event.body}`);
        const validate      = await new Validator(UpdateUser).validate(parsedBody);

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, validate.message, null);
        }

        const connection    = await new Database().getConnection();
        const userService   = new UserService(connection);
        const user          = await userService.getUserById(Number(event.pathParameters?.userId))
        if (!user) {
            return ResponseService.baseResponseJson(422, 'User not found', null);
        }
        const updated       = await userService.updateUserById({
            userId  : Number(userId), 
            input   : parsedBody,
            user    : user
        });

        if (!updated) return ResponseService.baseResponseJson(422, 'Update user failed!', {});

        return ResponseService.baseResponseJson(200, 'Success', {})
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

exports.updateUserById = new MiddlewareWrapper().init(updateUserById, [checkBannedMiddleware()]);