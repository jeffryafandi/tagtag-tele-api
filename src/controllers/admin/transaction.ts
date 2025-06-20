import * as lambda from 'aws-lambda';
import { Database } from '../../database';
import { UserService } from '../../services/user';
import { ResponseService } from '../../services/response';
import { BaseResponse } from '../../interfaces/generals/response';
import { HelperService } from '../../services/helper';
import dayjs from 'dayjs';
import { SUBTRACT_DAY } from '../../config/constants';
import { TransactionService } from '../../services/transaction';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';

const init = async () => {
    const connection    = await new Database().getConnection();
    const helperService = new HelperService();
    const userService   = new UserService(connection);

    return {connection, helperService, userService}
}

export const userHistoryLogTransaction: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const helperService         = new HelperService();
    const transactionService    = new TransactionService(connection);
    let startDate               = event.queryStringParameters?.startDate;
    let endDate                 = event.queryStringParameters?.endDate;
    const filters = {
        startDate,
        endDate,
        page: Number(event.queryStringParameters?.page || 1)
    }

    if (!endDate) {
        endDate = dayjs().format('YYYY-MM-DD');
    }
    if (!startDate) {
       startDate =  dayjs(helperService.substractDays(`${endDate}T00:00:00`, SUBTRACT_DAY)).format('YYYY-MM-DD');
    }
    console.log(startDate)
    console.log(endDate)

    const [mappedUserLogs, total] =  await transactionService.userHistoryLogTransaction(filters, startDate, endDate);
    const mapped = mappedUserLogs.map((userLog: any) => {
        const data = {
            id          : Number(userLog.transaction_id),
            user_id     : Number(userLog.transaction_user_id),
            username    : userLog.username,
            description : userLog.transaction_description,
            code        : userLog.transaction_code,
            extras      : userLog.transcation_extras,
            created_at  : userLog.transaction_created_at,
            updated_at  : userLog.transaction_updated_at,
            details: []
        }
        const details: any = [];
        if (userLog.details_type || userLog.details_value || userLog.details_currency) {
            details.push({
                type     : userLog.details_type,
                value    : userLog.details_value,
                currency : userLog.details_currency
            });
        }
        data.details = details;
        return data;
    });
    
    return ResponseService.baseResponseJson(200, 'Data fetched successfully', mapped, helperService.generatePagination(event, total));
}

// exports.userHistoryLogTransaction            = new AdminMiddlewareWrapper().init(userHistoryLogTransaction, [adminCheckWhitelistIp()]);