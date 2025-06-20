import * as lambda from 'aws-lambda';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { Database } from '../database';
import { AuthService } from '../services/auth';
import { Validator } from '../validators/base';
import { PrizepoolService } from '../services/prizepool';
import { GetPrizepoolWinnersRules, InitPrizepoolRules } from '../validators/prizepool';
import { PrizeDistributionsType, PrizepoolInitRequest } from '../interfaces/requests/prizepool';
import _ from "underscore";
import dayjs from 'dayjs';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { HelperService } from '../services/helper';

export const prizepoolInit: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const prizepoolService  = new PrizepoolService(connection);
        
        if (!event.body) throw Error('Payload must be filled!');

        const parsedBody: PrizepoolInitRequest = JSON.parse(event.body);
        const validate = await new Validator(InitPrizepoolRules).validate(parsedBody);
        if (parsedBody.end_date <= parsedBody.start_date) {
            validate.status     = false;
            validate.message    = 'start_date is higher than the end_date'
        }

        parsedBody.days         = _.sortBy((parsedBody.days), (o) => o.date);
        parsedBody.days         = _.uniq(parsedBody.days, true, 'date');

        const dayDifferences    = prizepoolService.helperService.getDaysDifferences(
                                    new Date(parsedBody.end_date),
                                    new Date(parsedBody.start_date) 
                                );

        if ((dayDifferences + 1) !== parsedBody.days.length) {
            validate.status     = false;
            validate.message    = 'total data for `days` is not equal with the prizepool duration'
        } else {
            if (parsedBody.days[0].date < parsedBody.start_date || parsedBody.days[parsedBody.days.length-1].date > parsedBody.end_date) {
                validate.status     = false;
                validate.message    = "There's date in `days` data which is more than or less than the prizepool duration"                    
            }
        }

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const created = await prizepoolService.initNewPrizepool(parsedBody);
        if (!created) {
            return ResponseService.baseResponseJson(422, 'Cannot create another active prizepool', {});
        }
        return ResponseService.baseResponseJson(200, 'Create new data', {});
    } catch (error: any) {
        console.log(error)
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});   
    }
}

export const getLeaderBoardPrizepool: lambda.Handler = async (event:lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const handlers  = {
                'weekly'        : getWeeklyPrizepoolLeaderboard
            } as any;
            const apiPath   = event.pathParameters;
        
            if (apiPath && apiPath.type) {
                if (!['weekly', 'daily'].includes(apiPath.type)) throw Error('Invalid action it should be between `weekly` and `daily`')
                if (Object.keys(handlers).includes(apiPath.type)) {
                    return await handlers[apiPath.type](event);
                }
            }
            const authService       = new AuthService(connection);
            const prizepoolService  = new PrizepoolService(connection);
            const stringDate        = dayjs().format('YYYY-MM-DD');
            
            const user = await authService.getUserFromToken(`${event.headers.Authorization}`);
            const data = await prizepoolService.getPrizepoolLeaderboard(PrizeDistributionsType.daily, user);
            return ResponseService.baseResponseJson(200, 'Data fetched successfully', data);
        } catch (error: any) {
            console.log("[getLeaderBoardPrizepool].ERROR: ",error);
            return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});   
        }
    });
}

export const getWeeklyPrizepoolLeaderboard: lambda.Handler = async (event:lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const authService       = new AuthService(connection);
            const prizepoolService  = new PrizepoolService(connection);
            const user              = await authService.getUserFromToken(`${event.headers.Authorization}`);
            const data              = await prizepoolService.getPrizepoolLeaderboard(PrizeDistributionsType.weekly, user);
            return ResponseService.baseResponseJson(200, 'Data fetched successfully', data);
        } catch (error: any) {
            console.log("[getWeeklyPrizepoolLeaderboard].ERROR: ", error);
            return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});   
        }
    });
}

export const homePrizepools: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const prizepoolService  = new PrizepoolService(connection);

        const prizepools = await prizepoolService.homePrizepools();

        return ResponseService.baseResponseJson(200, 'Data fetched successfully', prizepools);
    });
}

export const getPrizepoolWinners: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const authService       = new AuthService(connection);
            const prizepoolService  = new PrizepoolService(connection);
            const prizepoolId       = event.pathParameters?.prizepoolId;
            let stringDate: string|undefined;
    
            if (!prizepoolId || isNaN(Number(prizepoolId))) return ResponseService.baseResponseJson(422, 'Path parameter is incorrect', {messages: 'invalid prizepoolID'});
            
            if (event.queryStringParameters) {
                const validate = await new Validator(GetPrizepoolWinnersRules).validate(event.queryStringParameters);
                if (!validate.status) {
                    return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
                }
                stringDate = event.queryStringParameters.date;
            };
    
            const user      = await authService.getUserFromToken(`${event.headers.Authorization}`);
            const winners   = await prizepoolService.getMapWinnersData(user, Number(prizepoolId), stringDate);
            
            return ResponseService.baseResponseJson(200, 'Data fetched successfully', winners);
        } catch (error: any) {
            console.log(error);
            return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
        }
    });
}

export const getPrizepoolParticipations: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const authService       = new AuthService(connection);
            const prizepoolService  = new PrizepoolService(connection);
            const params            = event.queryStringParameters;
            const type              = params?.type ? `${params.type}` : 'weekly';
            const user              = await authService.getUserFromToken(`${event.headers.Authorization}`);
            if (!user) throw Error('User is not found!');
    
            const participations    = await prizepoolService.getUserParticipations(user, type as PrizeDistributionsType);
    
            return ResponseService.baseResponseJson(200, 'Data fetched successfully', participations);
        } catch (error: any) {
            return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
        }
    });
}

// exports.getPrizepoolParticipations  = new MiddlewareWrapper().init(getPrizepoolParticipations, [checkBannedMiddleware()]);
// exports.getPrizepoolWinners         = new MiddlewareWrapper().init(getPrizepoolWinners, [checkBannedMiddleware()]);
// exports.getLeaderBoardPrizepool     = new MiddlewareWrapper().init(getLeaderBoardPrizepool, [checkBannedMiddleware()]);