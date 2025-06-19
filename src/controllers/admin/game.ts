import * as lambda from 'aws-lambda';
import { Database } from '../../database';
import { ResponseService } from '../../services/response';
import { BaseResponse } from '../../interfaces/generals/response';
import { GameService } from '../../services/game';
import { AuthService } from '../../services/auth';
import { SubmitHighscoreRules } from '../../validators/game';
import { Validator } from '../../validators/base';
import dayjs from 'dayjs';
import { HelperService } from '../../services/helper';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';


export const storeUserGameScore: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const gameService   = new GameService(connection);
        const authService   = new AuthService(connection);
        const user          = await authService.getUserFromToken(`${event.headers.Authorization}`)
        const gameId        = event.pathParameters?.gameId;
        
        if (!gameId || isNaN(Number(gameId))) throw Error('Invalid gameID');
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        let parsedBody: {values: number};

        try {
            if (!event.body) throw Error('Payload cannot be empty');
            parsedBody = JSON.parse(`${event.body}`);
        } catch (error) {
            throw Error('Payload is incorrect!')
        }

        const validate      = await new Validator(SubmitHighscoreRules).validate(parsedBody);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const latest        = await gameService.getLatestUserGameScore(user.id);
        let gameSession     = authService.helperService.generateUUIDCode();
        
        if (latest) {
            gameSession = latest.session_code || gameSession;
        }

        await gameService.insertGameScore({
            user_id     : user.id,
            game_id     : Number(gameId),
            session_code: gameSession,
            score       : Number(parsedBody.values)
        });
        return ResponseService.baseResponseJson(200, 'Game score Stored successfully', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }

}
export const getGameAnalytic: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection      = await new Database().getConnection();
    const helperService   = new HelperService();
    const gameService     = new GameService(connection);
    let startDate         = event.queryStringParameters?.startDate;
    let endDate           = event.queryStringParameters?.endDate;
    console.log(startDate)
    console.log(endDate)
    if (!endDate) {
       endDate =  dayjs().format('YYYY-MM-DD');
    } 
    if (!startDate) {
       startDate =  dayjs(helperService.substractDays(`${endDate}T00:00:00`, 6)).format('YYYY-MM-DD');
    }
    const getGameAnalytic = await gameService.getGameAnalytic({start_date : startDate, end_date : endDate})


    return ResponseService.baseResponseJson(200, 'Success', getGameAnalytic)
}

// exports.getGameAnalytic            = new AdminMiddlewareWrapper().init(getGameAnalytic, [adminCheckWhitelistIp()]);