import * as lambda from 'aws-lambda';
import { Database } from '../../database';
import { UserService } from '../../services/user';
import { ResponseService } from '../../services/response';
import { BaseResponse } from '../../interfaces/generals/response';
import { HelperService } from '../../services/helper';
import dayjs from 'dayjs';
import { AwdService } from '../../services/awd';
import { SUBTRACT_DAY } from '../../config/constants';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';

const init = async () => {
    const connection    = await new Database().getConnection();
    const helperService = new HelperService();
    const userService   = new UserService(connection);

    return {connection, helperService, userService}
}

export const fetchUserAwdLogs: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection      = await new Database().getConnection();
    const helperService   = new HelperService();
    const awdService      = new AwdService(connection);
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

    let mappedUserAwdLogs =  await awdService.getUsersAwdLogs(startDate, endDate);

    return ResponseService.baseResponseJson(200, 'Data fetched successfully', mappedUserAwdLogs);
}

// exports.fetchUserAwdLogs            = new AdminMiddlewareWrapper().init(fetchUserAwdLogs, [adminCheckWhitelistIp()]);