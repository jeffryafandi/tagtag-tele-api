import { BaseService } from "./base";
import { Games } from "../entities/games";
import { UserGameScores } from "../entities/user-game-scores";
import { FilterGameAnalytic } from "../interfaces/requests/game";
import dayjs from "dayjs";
import { GameTutorials } from "../entities/game-tutorials";
import _ from "underscore";

export type basicGameObject = {
    id                          : number;
    name                        : string;
    banner_url                  : string;
    game_url                    : string;
    casual_threshold            : number; 
    casual_coin_prize           : number;
    casual_stamina_prize        : number;
    casual_coupon_prize         : number;
    casual_activity_point_prize : number;  
}
export class GameService extends BaseService {
    // public async getAllGames(): Promise<Games[]> {
    //     const [games, count] = await this.dbConn.getRepository(Games)
    //     .createQueryBuilder('games')
    //     .leftJoinAndSelect('games.missions', 'missions', 'missions.game_id = games.id AND missions.deleted_at is null')
    //     .leftJoinAndSelect('games.quests', 'quests', 'quests.game_id = games.id AND quests.deleted_at is null')
    //     .getManyAndCount();

    //     return games;
    // }

    public async getAllGames(preset_id?: number): Promise<Games[]> {
        const queryBuilder = this.dbConn.getRepository(Games)
            .createQueryBuilder('games')
            .leftJoinAndSelect('games.missions', 'missions', 'missions.game_id = games.id AND missions.deleted_at is null')
            .leftJoinAndSelect('games.quests', 'quests', 'quests.game_id = games.id AND quests.deleted_at is null');

        if (preset_id) {
            queryBuilder
                .andWhere('missions.preset_id = :presetId', { presetId: preset_id })
                .andWhere('quests.preset_id = :presetId', { presetId: preset_id });
        }

        const [games, count] = await queryBuilder.getManyAndCount();

        return games;
    }

    public mapBasicGameObject(game: Games): basicGameObject {
        return {
            id                          : game.id,
            name                        : game.name,
            banner_url                  : game.banner_url,
            game_url                    : game.game_url,
            casual_threshold            : game.casual_threshold,
            casual_coin_prize           : game.casual_coin_prize,
            casual_stamina_prize        : game.casual_stamina_prize,
            casual_coupon_prize         : game.casual_coupon_prize,
            casual_activity_point_prize : game.casual_activity_point_prize

        }
    }

    public async getUserHighscoreByGameId(gameId: number, userId: number): Promise<number> {
        if (!gameId || !userId) return 0;
        const userGame = await this.dbConn.getRepository(UserGameScores)
        .createQueryBuilder()
        .select("MAX(score)", "score")
        .where("user_id = :userId", {userId})
        .andWhere("game_id = :gameId", {gameId})
        .getRawOne();

        if (!userGame) return 0;
        return Number(userGame.score);
    }

    public async getLatestUserGameScore(userId: number): Promise<UserGameScores|null>  {
        const userGame = await this.dbConn.getRepository(UserGameScores)
        .findOne({
            where: {
                user_id: userId
            },
            order: {
                created_at: 'DESC'
            }
        });
        return userGame;
    }

    public async getUserTotalPlayed(userId: number): Promise<number> {
        const latesstGameScore = await this.dbConn.getRepository(UserGameScores)
        .createQueryBuilder('userGameScores')
        .select("COUNT(userGameScores.session_code)", "totalPlayed")
        .where("userGameScores.session_code = (SELECT session_code FROM user_game_scores WHERE user_id = :userId ORDER BY created_at DESC LIMIT 1)", {userId})
        .groupBy("userGameScores.session_code")
        .getRawOne();

        return latesstGameScore?.totalPlayed ? Number(latesstGameScore.totalPlayed) : 0;
    }

    // public async getTotalPlayerUser(gameId: number, startDate: string, endDate: string): Promise<number> {
    //     const latesstGameScore = await this.dbConn.getRepository(UserGameScores)
    //     .createQueryBuilder('userGameScores')
    //     .select("COUNT(userGameScores.session_code)", "totalPlayer")
    //     .where("userGameScores.session_code = (SELECT session_code FROM user_game_scores WHERE game_id = :gameId ORDER BY created_at DESC LIMIT 1)", {gameId})
    //     .andWhere('userGameScores.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
    //     .groupBy("userGameScores.session_code")
    //     .getRawOne();

    //     return latesstGameScore?.totalPlayed ? Number(latesstGameScore.totalPlayed) : 0;
    // }

    public async getTotalPlayer(gameId: number, startDate: string, endDate: string) {
        return await this.dbConn.getRepository(UserGameScores)
        .createQueryBuilder('userGameScores')
        .where('userGameScores.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
        .andWhere('userGameScores.game_id = :game_id', {game_id : gameId})
        .groupBy('userGameScores.user_id')
        .getMany()

    }
    public async getTotalPlayed(gameId: number, startDate: string, endDate: string) {
        return await this.dbConn.getRepository(UserGameScores)
        .createQueryBuilder('userGameScores')
        .where('userGameScores.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
        .andWhere('userGameScores.game_id = :game_id', {game_id : gameId})
        .getCount()

    }   

    public async getGameAnalytic(input: FilterGameAnalytic){
        const games     = await this.getAllGames();
        const startDate = input.start_date;
        const endDate   = input.end_date;
        
        const formattedStartDate = this.helperService.substractHours(dayjs(`${startDate} 00:00:00`).format('YYYY-MM-DD HH:mm:ss'), 7);
        const formattedEndDate   = this.helperService.substractHours(dayjs(`${endDate} 23:59:59`).format('YYYY-MM-DD HH:mm:ss'), 7);
        const getDaysDifferences = this.helperService.getDaysDifferences(new Date (input.end_date), new Date (input.start_date))
        console.log(getDaysDifferences)

        const data = [];
        for (const game of games) {
            const totalPlayer = (await this.getTotalPlayer(game.id, formattedStartDate, formattedEndDate)).length
            const totalPlayed = await this.getTotalPlayed(game.id, formattedStartDate, formattedEndDate)
            const AvgPlaying  = totalPlayed / (getDaysDifferences + 1)
            const response = {
                id           : game.id,
                game_name    : game.name,
                total_player : totalPlayer,
                total_played : totalPlayed,
                avg_playing  : AvgPlaying.toFixed(1)
            }
            data.push(response)
        }

        return data;
    }

    public async insertGameScore(schema: {user_id: number; game_id: number; score: number, session_code?: string}): Promise<UserGameScores> {
        return await this.dbConn.getRepository(UserGameScores).save(schema);
    }

    public async getGameById(gameId: number): Promise<Games|null> {
        return await this.dbConn.getRepository(Games).findOne({where: {id: gameId}});
    }

    public async fetchGameScoreByGameIdAndUserId(userId: number, gameId: number): Promise<UserGameScores|null> {
        return await this.dbConn.getRepository(UserGameScores).findOne({ where: {game_id: gameId, user_id: userId }});
    }

    public async fetchGameTutorialsByGameId(gameId: number): Promise<GameTutorials[]> {
        return await this.dbConn.getRepository(GameTutorials)
        .createQueryBuilder()
        .where('game_id = :gameId', {gameId})
        .getMany();
    }

    public async mapGameTutorialByGameId(gameId: number) {
        let tutorials   = await this.fetchGameTutorialsByGameId(gameId);
        tutorials       = _.sortBy((tutorials), (o) => o.slide_order);

        return tutorials.map((tutorial) => ({
            game_id     : tutorial.game_id,
            title       : tutorial.title,
            description : tutorial.description,
            media_url   : tutorial.media_url,
            media_type  : tutorial.media_type,
            slide_order : tutorial.slide_order
        }));
    }
}
