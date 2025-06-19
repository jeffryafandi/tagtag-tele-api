import * as lambda from 'aws-lambda';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { Database } from '../database';
import { RaffleService } from '../services/raffle';
import { AuthService } from '../services/auth';
import { Validator } from '../validators/base';
import { SubmitToRafffleRules } from '../validators/raffle';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { RAFFLE_TICKET_LIMIT } from '../config/constants';
import { APP_CONFIG_KEY } from '../config/app-config-constant';
import { HelperService } from '../services/helper';

export const getRaffles: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const raffleService = new RaffleService(connection);
        const authService   = new AuthService(connection);
        const user          = await authService.getUserFromToken(`${event.headers.Authorization}`);
        const data          = await raffleService.mapUserRaffleData(user);

        return ResponseService.baseResponseJson(200, 'Data fetch successfully', data);
    });
}

export const getRaffleDetail: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const raffleService = new RaffleService(connection);
        const authService   = new AuthService(connection);
        const raffleId      = Number(event.pathParameters?.raffleId || 0);
        const user          = await authService.getUserFromToken(`${event.headers.Authorization}`);
        const data          = await raffleService.getRafflesDetailData(raffleId, user);

        return ResponseService.baseResponseJson(200, 'Data fetch successfully', data);
    });
}

export const submitRaffle: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const raffleService = new RaffleService(connection);
        const authService   = new AuthService(connection);
        const raffleId      = Number(event.pathParameters?.raffleId || 0);
        const user          = await authService.getUserFromToken(`${event.headers.Authorization}`);
        let ticketLimit     = RAFFLE_TICKET_LIMIT;

        if (!raffleId) throw Error('raffle ID is required');
        
        let parsedBody: {coupons: number};

        try {
            parsedBody = JSON.parse(`${event.body}`);
        } catch (error) {
            throw Error('Payload is incorrect!')
        }
        if (!parsedBody) throw Error('Payload cannot be empty');

        let validate = await new Validator(SubmitToRafffleRules).validate(parsedBody);
        if ((user?.coupons || 0) < parsedBody.coupons) {
            validate = {status: false, message: 'Inserted coupons is higher than your current coupon!'}
        }

        const submitRaffleConfig = await raffleService.appConfigService.getConfigByKey(APP_CONFIG_KEY.raffleTicketLimit);
        if (submitRaffleConfig) {
            ticketLimit = Number(submitRaffleConfig.config_value);
        }

        if (parsedBody.coupons > ticketLimit) {
            validate = {status: false, message: `Inserted coupons is exceeding the limts! The maximum inserted ticket is ${ticketLimit}`}
        }

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const raffle        = await raffleService.fetchRaffleById(raffleId);

        if (!raffle) return ResponseService.baseResponseJson(404, 'Raffle is not found', {});
        if (raffle.inserted_coupons >= raffle.target_pools) return ResponseService.baseResponseJson(422, 'Submission limit reached', {});

        const isCompleted = await raffleService.userSubmitCouponToRaffle(raffleId, user, parsedBody.coupons);

        return ResponseService.baseResponseJson(200, 'Coupon Submit Success!', {is_completed: isCompleted});
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Server Error', {error: `${error}`});
    }
}


// exports.getRaffles      = new MiddlewareWrapper().init(getRaffles, [checkBannedMiddleware()]);
// exports.getRaffleDetail = new MiddlewareWrapper().init(getRaffleDetail, [checkBannedMiddleware()]);
// exports.submitRaffle    = new MiddlewareWrapper().init(submitRaffle, [checkBannedMiddleware()]);
