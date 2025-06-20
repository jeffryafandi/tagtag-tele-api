import * as lambda from 'aws-lambda';
import { Database } from '../../database';
import { UserService } from '../../services/user';
import { ResponseService } from '../../services/response';
import { BaseResponse } from '../../interfaces/generals/response';
import { HelperService } from '../../services/helper';
import dayjs from 'dayjs';
import { SUBTRACT_DAY } from '../../config/constants';
import { RaffleService } from '../../services/raffle';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';

const init = async () => {
    const connection    = await new Database().getConnection();
    const helperService = new HelperService();
    const userService   = new UserService(connection);

    return {connection, helperService, userService}
}

export const userHistoryLogRaffleWinners: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const helperService         = new HelperService();
    const raffleServices        = new RaffleService(connection);
    const filters                 = event.queryStringParameters;

    const [mappedUserLogs, total] =  await raffleServices.userHistoryRaffleWinner(filters);
    const mapped = mappedUserLogs.map((userLog: any) => {
        const data = {
            raffle_id             : Number(userLog.raffles_id),
            raffle_name           : userLog.raffles_name,
            user_id               : userLog.raffleTickets_user_id,
            username              : userLog.username,
            coupon_prize          : userLog.rafflePrizes_coupon_prize,
            coin_prize            : userLog.rafflePrizes_coin_prize,
            game_inventory_id     : userLog.gameInventory_id,
            game_inventory_name   : userLog.gameInventory_name,
            external_prize_id     : userLog.extPrizes_id,
            activity_point_prize  : userLog.rafflePrizes_activity_point_prize,
            prize_order           : userLog.rafflePrizes_prize_order,
            is_claimed            : userLog.rafflePrizes_is_claimed,
        }
        return data;
    });
    console.log(mappedUserLogs)
    
    return ResponseService.baseResponseJson(200, 'Data fetched successfully', mapped, helperService.generatePagination(event, total));
}

// exports.userHistoryLogRaffleWinners            = new AdminMiddlewareWrapper().init(userHistoryLogRaffleWinners, [adminCheckWhitelistIp()]);