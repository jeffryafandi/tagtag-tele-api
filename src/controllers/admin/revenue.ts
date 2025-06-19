import * as lambda from 'aws-lambda';
import { Database } from '../../database';
import { UserService } from '../../services/user';
import { ResponseService } from '../../services/response';
import { BaseResponse } from '../../interfaces/generals/response';
import { HelperService } from '../../services/helper';
import dayjs from 'dayjs';
import { SUBTRACT_DAY } from '../../config/constants';
import { RevenueService } from '../../services/revenue';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';

const init = async () => {
    const connection    = await new Database().getConnection();
    const helperService = new HelperService();
    const userService   = new UserService(connection);

    return {connection, helperService, userService}
}

export const usersRevenueDetail: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection     = await new Database().getConnection();
    const helperService  = new HelperService();
    const revenueService = new RevenueService(connection);
    let startDate        = event.queryStringParameters?.startDate;
    let endDate          = event.queryStringParameters?.endDate;
    let filters = {
        startDate,
        endDate,
        page: Number(event.queryStringParameters?.page || 1)
    }

    if (!endDate) {
        endDate = dayjs().format('YYYY-MM-DD');
    }
    
    if (!startDate) {
       startDate = dayjs(helperService.substractDays(`${endDate}T00:00:00`, SUBTRACT_DAY)).format('YYYY-MM-DD');
    }
    
    console.log(startDate)
    console.log(endDate)

    let [mappedUserRevenue, total] =  await revenueService.usersRevenueDetail(filters, startDate, endDate);
    
    return ResponseService.baseResponseJson(200, 'Data fetched successfully', mappedUserRevenue, helperService.generatePagination(event, total));
}

// exports.usersRevenueDetail            = new AdminMiddlewareWrapper().init(usersRevenueDetail, [adminCheckWhitelistIp()]);
