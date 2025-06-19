import * as lambda from 'aws-lambda';
import { Database } from '../../database';
import { UserService } from '../../services/user';
import { ResponseService } from '../../services/response';
import { BaseResponse } from '../../interfaces/generals/response';
import { Validator } from '../../validators/base';
import { HelperService } from '../../services/helper';
import { BanUnBanUsersRules, UserAnalytic } from '../../validators/user';
import dayjs from 'dayjs';
import { BanUnBanUsersRequest } from '../../interfaces/requests/users';
import { SUBTRACT_DAY } from '../../config/constants';
import { UpdateUser } from '../../validators/auth';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';

const init = async () => {
    const connection    = await new Database().getConnection();
    const helperService = new HelperService();
    const userService   = new UserService(connection);

    return {connection, helperService, userService}
}

export const getUserAnalytic: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const { 
        userService, 
        helperService 
    }               = await init();
    let startDate   = event.queryStringParameters?.startDate;
    let endDate     = event.queryStringParameters?.endDate;

    if (!endDate) {
        endDate = dayjs().format('YYYY-MM-DD');
    }
    if (!startDate) {
        startDate = dayjs(helperService.substractDays(`${endDate}T00:00:00`, SUBTRACT_DAY)).format('YYYY-MM-DD');
    }

    const arrayDate = [];
    let date        = startDate;

    do {
        arrayDate.push(date);
        date = dayjs(helperService.addDays(date, 1)).format('YYYY-MM-DD');
    } while (date <= endDate);

    const results = [];
    for (const date of arrayDate) {
        const startDate         = helperService.substractHours(`${date}T00:00:00`, 7);
        const endDate           = helperService.substractHours(`${date}T23:59:59`, 7);
        const getUserAnalytic   = await userService.getUserAnalytic({ start_date: startDate, end_date: endDate });

        if (getUserAnalytic == undefined) {
            return ResponseService.baseResponseJson(422, 'Something is wrong', null)
        }

        results.push({ ...getUserAnalytic, date });
    }

    return ResponseService.baseResponseJson(200, 'Success', results)
}

export const adminBanUser: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const { userService } = await init();
    try {
        if (!event.body) throw Error('Body cannot be null!');
        const payload: BanUnBanUsersRequest = JSON.parse(`${event.body}`);

        const validate = await new Validator(BanUnBanUsersRules).validate(payload);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Something Error', {messages: validate.message});
        }

        await userService.banUserByIds(payload);
        return ResponseService.baseResponseJson(200, 'Success banning users', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const adminUnBanUser: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const { userService } = await init();
    try {
        if (!event.body) throw Error('Body cannot be null!');
        const payload: BanUnBanUsersRequest = JSON.parse(`${event.body}`);

        const validate = await new Validator(BanUnBanUsersRules).validate(payload);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Something Error', {messages: validate.message});
        }

        await userService.unBanUserByIds(payload);
        return ResponseService.baseResponseJson(200, 'Success un-banning users', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const getAllUsers: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection      = await new Database().getConnection();
    const helperService   = new HelperService();
    const userService     = new UserService(connection);

    let filters = event.queryStringParameters;
    
    let [mappedList, total] = await userService.mappedAllUsers(filters);

    return ResponseService.baseResponseJson(200, 'Success', mappedList, helperService.generatePagination(event, total))
}

export const updateUserById: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
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

export const userWithdrawDetail: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection      = await new Database().getConnection();
    const helperService   = new HelperService();
    const userService     = new UserService(connection);
    let startDate         = event.queryStringParameters?.startDate;
    let endDate           = event.queryStringParameters?.endDate;
    if (!endDate) {
        endDate = dayjs().format('YYYY-MM-DD');
    }
    if (!startDate) {
       startDate =  dayjs(helperService.substractDays(`${endDate}T00:00:00`, SUBTRACT_DAY)).format('YYYY-MM-DD');
    }
     console.log(startDate)
     console.log(endDate)

    let mappedUserLogs =  await userService.userWithdrawDetail(startDate, endDate);

    return ResponseService.baseResponseJson(200, 'Data fetched successfully', mappedUserLogs);
}

// exports.getUserAnalytic            = new AdminMiddlewareWrapper().init(getUserAnalytic, [adminCheckWhitelistIp()]);
// exports.adminBanUser               = new AdminMiddlewareWrapper().init(adminBanUser, [adminCheckWhitelistIp()]);
// exports.adminUnBanUser             = new AdminMiddlewareWrapper().init(adminUnBanUser, [adminCheckWhitelistIp()]);
// exports.getAllUsers                = new AdminMiddlewareWrapper().init(getAllUsers, [adminCheckWhitelistIp()]);
// exports.updateUserById             = new AdminMiddlewareWrapper().init(updateUserById, [adminCheckWhitelistIp()]);
// exports.userWithdrawDetail         = new AdminMiddlewareWrapper().init(userWithdrawDetail, [adminCheckWhitelistIp()]);