import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { GameService } from '../services/game';
import { AuthService } from '../services/auth';
import { SubmitHighscoreRules } from '../validators/game';
import { Validator } from '../validators/base';
import dayjs from 'dayjs';
import { HelperService } from '../services/helper';
import { UserActivityService } from '../services/user-activity';
import { UserActivityTypeEnum } from '../entities/user-activities';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';


export const storeUserGameScore: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection            = await new Database().getConnection();
        const gameService           = new GameService(connection);
        const authService           = new AuthService(connection);
        const userActivityService   = new UserActivityService(connection);
        const user                  = await authService.getUserFromToken(`${event.headers.Authorization}`)
        const gameId                = event.pathParameters?.gameId;
        
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

        await userActivityService.storeNewUserActivity({
            user_id     : user.id,
            logable_id  : Number(gameId),
            logable_type: 'games',
            type        : UserActivityTypeEnum.activity,
            description : ''
        });

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

export const getGameTutorials: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const gameService   = new GameService(connection);
            const gameId        = event.pathParameters?.gameId;
        
            if (!gameId || isNaN(Number(gameId))) throw Error('Invalid gameID');
    
            const mappedTutorials = await gameService.mapGameTutorialByGameId(Number(gameId));
            return ResponseService.baseResponseJson(200, 'Game Tutorial is Fetched successfully', mappedTutorials);
        } catch (error: any) {
            return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
        }
    });
}

// exports.storeUserGameScore = new MiddlewareWrapper().init(storeUserGameScore, [checkBannedMiddleware()]);
