import { BasePrizepoolSchema, PrizeDistributionsType, PrizepoolDayRequest, PrizepoolInitRequest } from '../interfaces/requests/prizepool';
import { Prizepools } from "../entities/prizepools";
import { BaseService } from "./base";
import { PrizepoolDailyPercentages } from "../entities/prizepool-daily-percentages";
import { TransactionService } from "./transaction";
import { Connection, InsertResult } from "typeorm";
import { PrizepoolDistributions } from "../entities/prizepool-distributions";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Users } from "../entities/users";
import { BaseLeaderboardResponse, BasePrizepoolResponse, PrizepoolLeaderboardResponse, BaseLeaderboardPreviousWinnerResponse } from "../interfaces/responses/prizepool";
import { PrizepoolIncrementLogs } from "../entities/prizepool-increment-logs";
import { PrizepoolIncrementLogPayload } from "../validators/prizepool";
import dayjs from 'dayjs';
import _ from "underscore";
import { UserService } from "./user";
import { TRANSACTION_AVAILABLE_CODE, TRANSACTION_DESCRIPTIONS, REDIS_TTL_DAILY_LEADERBOARD, REDIS_TTL_WEEKLY_LEADERBOARD, REDIS_TTL_PRIZEPOOL_WINNER } from "../config/constants";
import { NOTIF_CODE, TRIGGERS } from "../config/notif-constant";
import { NotificationService } from "./fcm-notification";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import redis from './redis';

export class PrizepoolService extends BaseService {
    protected transactionService    : TransactionService;
    protected userService           : UserService;
    protected notificationService   : NotificationService;

    constructor (connection: Connection) {
        super(connection);
        this.userService            = new UserService(connection);
        this.transactionService     = new TransactionService(connection);
        this.notificationService    = new NotificationService(connection);
    }

    public async fetchPrizepoolById(prizepoolId: number): Promise<Prizepools|null> {
        return await this.dbConn.getRepository(Prizepools)
        .findOne({
            where: {
                id: prizepoolId
            },
            join: {
                alias: 'prizepools',
                leftJoinAndSelect: {
                    daillyPercentages   : 'prizepools.dailyPercentages',
                    distributions       : 'prizepools.distributions',
                    user                : 'distributions.user'
                }
            }
        })
    }

    public async fetchLatestActivePrizepool(): Promise<Prizepools|null> {
        return await this.dbConn.getRepository(Prizepools)
        .findOne({
            where: {
                is_active: true
            },
            order: {
                updated_at: 'DESC'
            },
            join: {
                alias: 'prizepools',
                leftJoinAndSelect: {
                    daillyPercentages: 'prizepools.dailyPercentages',
                }
            }
        });
    }

    public async findIncrementLogBySources(sourceId: number, source: string): Promise<PrizepoolIncrementLogs|null> {
        return await this.dbConn.getRepository(PrizepoolIncrementLogs)
        .findOne({
            where: {
                source_id: sourceId,
                source: source
            },
        });
    }

    public async createPrizepool(payload: BasePrizepoolSchema): Promise<Prizepools> {
        return await this.dbConn.getRepository(Prizepools)
        .save(payload);
    }

    public async createDailyPrizepool(prizepool: Prizepools, dailyPercentage: PrizepoolDayRequest): Promise<PrizepoolDailyPercentages> {
        return await this.dbConn.getRepository(PrizepoolDailyPercentages)
        .save({
            prizepool_id                    : prizepool.id,
            date                            : dailyPercentage.date,
            percentage                      : dailyPercentage.prizepools_percentage,
            increment_value_ads_rewarded    : dailyPercentage.increment_value_ads_rewarded,
            increment_value_ads_interstitial: dailyPercentage.increment_value_ads_interstitial
        });
    }
    
    public async initNewPrizepool(payload: PrizepoolInitRequest): Promise<boolean> {
        const prizepool = await this.fetchLatestActivePrizepool();
        if (prizepool) return false;

        const newPrizepool = await this.createPrizepool({
            ...payload,
            weekly_distributions: JSON.stringify(payload.weekly_distributions),
            daily_distributions : JSON.stringify(payload.daily_distributions) 
        });

        for (const day of payload.days) {
            await this.createDailyPrizepool(newPrizepool, day); 
        }

        return true;
    }

    public async createPrizepoolDistributions(data: any[]): Promise<InsertResult> {
        return await this.dbConn.getRepository(PrizepoolDistributions)
        .createQueryBuilder()
        .insert()
        .into(PrizepoolDistributions)
        .values(data)
        .execute();
    }

    public async deletePrizeDistribution(type: PrizeDistributionsType, prizepool: Prizepools, dailyId: number | undefined = undefined): Promise<void> {
        let criteria = {
            prizepool_id: prizepool.id,
            prizepool_daily_percentage_id: type === PrizeDistributionsType.daily ? dailyId : 0
        }
        await this.dbConn.getRepository(PrizepoolDistributions).delete(criteria);
    }

    public async updatePrizepool(prizepool: Prizepools, schema: QueryDeepPartialEntity<Prizepools>) {
        await this.dbConn.getRepository(Prizepools)
        .update(prizepool.id, schema);
    }

    public async getTotalIncrementValue(prizepool: Prizepools): Promise<number> {
        let valueToAdd = 0;
        const totalIncrementLogs    = await this.dbConn.getRepository(PrizepoolIncrementLogs)
                                    .createQueryBuilder('increment_logs')
                                    .select('SUM(increment_logs.increment_value)', 'total_value')
                                    .where('increment_logs.prizepool_id = :prizepoolId', {prizepoolId: prizepool.id})
                                    .andWhere('increment_logs.deleted_at IS NULL')
                                    .groupBy('increment_logs.prizepool_id')
                                    .getRawOne();
        if (totalIncrementLogs) {
            valueToAdd += Number(totalIncrementLogs.total_value);
        }
        return valueToAdd;
    }

    public async getTotalPrizepoolReduction(prizepool: Prizepools): Promise<number> {
        let totalSpent = 0;
        const totalDistributions    = await this.dbConn.getRepository(PrizepoolDistributions)
                                    .createQueryBuilder('distributions')
                                    .select('SUM(distributions.value)', 'total_spent')
                                    .where('distributions.prizepool_id = :prizepoolId', {prizepoolId: prizepool.id})
                                    .groupBy('distributions.prizepool_id')
                                    .getRawOne()
        if (totalDistributions) {
            totalSpent += totalDistributions.total_spent;
        }
        return totalSpent;
    }

    public async generatePrizepoolWinners(distributions: number[], winnersList: any[], prizepool: Prizepools, dailyPercentage: PrizepoolDailyPercentages | undefined = undefined) {
        const increment     = await this.getTotalIncrementValue(prizepool);
        const totalSpent    = await this.getTotalPrizepoolReduction(prizepool);
        let prizepoolValue  = (increment + prizepool.total_pools) - totalSpent;
        let type            = PrizeDistributionsType.weekly;
        let dailyId         = 0;

        if (dailyPercentage) {
            prizepoolValue  = Math.ceil(prizepoolValue * dailyPercentage.percentage);
            type            = PrizeDistributionsType.daily;
            dailyId         = dailyPercentage.id;
        }

        const list = winnersList.map((winner, index) => {
            const distribution = distributions[index];

            return {
                prizepool_id                    : prizepool.id,
                user_id                         : Number(winner.user_id),
                position                        : winner.position,
                type                            : type,
                prizepool_daily_percentage_id   : dailyId,
                value                           : Math.ceil(prizepoolValue * distribution),
                raw                             : winner
            }
        });

        return list;
    }

    public async copyAndCreatePrizepool(prizepool: Prizepools): Promise<Prizepools> {
        const startDate     = this.helperService.addDays(prizepool.start_date, 7);
        const endDate       = this.helperService.addDays(prizepool.end_date, 7);

        const newPrizepool  = await this.createPrizepool({
            total_pools                     : prizepool.total_pools,
            start_date                      : startDate,
            end_date                        : endDate,
            increment_value_ads_interstitial: prizepool.increment_value_ads_interstitial,
            increment_value_ads_rewarded    : prizepool.increment_value_ads_rewarded,
            value_per_purchase              : prizepool.value_per_purchase,
            daily_distributions             : prizepool.daily_distributions,
            weekly_distributions            : prizepool.weekly_distributions,
            is_active                       : true
        });

        let dailies         = prizepool.dailyPercentages;
        dailies             = _.sortBy((dailies), (o) => o.date);

        for (const day of dailies) {
            const dailyRequest: PrizepoolDayRequest = {
                date                            : this.helperService.addDays(day.date, 7),
                prizepools_percentage           : day.percentage,
                increment_value_ads_rewarded    : day.increment_value_ads_rewarded,
                increment_value_ads_interstitial: day.increment_value_ads_interstitial
            };

            await this.createDailyPrizepool(newPrizepool, dailyRequest); 
        }

        return newPrizepool;
    }

    public async commitWinnerPrize(payloads: any[], type: PrizeDistributionsType) {
        const filteredWinners   = payloads.filter((payload) => payload.value > 0);
        let position            = 1;

        for (const winner of filteredWinners) {
            await this.userService.update(winner.user_id, {coins: Number(winner.raw.user_coins) + winner.value});
            const updatedUser = await this.userService.getUser(winner.user_id);
            const transactionPayload = {
                description : TRANSACTION_DESCRIPTIONS.WON_PRIZEPOOL,
                code        : TransactionAvailableCodeEnum.PRIZEPOOL_REWARD,
                user_id     : Number(winner.user_id),
                extras      : JSON.stringify({
                    data: {
                        prizepool_distributions: {
                            type    : type, //daily || weekly
                            position: position
                        }
                    }
                }),
                details : [
                    {
                        type    : 'CR',
                        currency: TransactionDetailCurrencyEnum.COIN,
                        value   : winner.value,
                        previous_value: winner.raw.user_coins,
                        current_value: updatedUser?.coins || 0
                    }
                ] as TransactionDetailRequest[]
            }
            await this.transactionService.storeUserTransaction(winner.user_id, transactionPayload);
            position ++;
        }
    }

    public async concludePrizepoolByDate(): Promise<boolean> {
        // const currentTime = this.helperService.toDateTime(dayjs('2025-03-13 17:00:00')); // if you want run manually
        const currentTime    = this.helperService.toDateTime(dayjs());
        const prizepool      = await this.fetchLatestActivePrizepool();
        if (!prizepool) return false;
        console.log("Trigger concludePrizepoolByDate " + dayjs().format());

        const currentDailyPrizepool = prizepool.dailyPercentages.filter((day) => {
            // we need to check yesterday prizepool dist
            // reduce 1 hour, to get yesterday date since the scheduler
            // always being ran after 17:00:00
            const yesterday = this.helperService.substractHours(currentTime, 1);
            const start = this.helperService.substractHours(`${day.date} 00:00:00`, 7);
            const end   = this.helperService.substractHours(`${day.date} 23:59:59`, 7);
            if (yesterday >= start && yesterday <= end) {
                return true;
            }
            return false;
        });
        // if daily
        if ( currentDailyPrizepool.length > 0 ) {
            const userDailyWinner   = await this.getPrizepoolDistributionUserIdsWeek(prizepool.id)
            const userIdsDailyWinner= userDailyWinner.map(item => item.user_id);
            const startDate         = this.helperService.substractHours(`${currentDailyPrizepool[0].date} 00:00:00`, 7);
            const endDate           = this.helperService.substractHours(`${currentDailyPrizepool[0].date} 23:59:59`, 7)
            const transactions      = await this.transactionService.getTransactionsByCurrencyAndPeriod(
                                        'activity_point',
                                        startDate,
                                        endDate,
                                        userIdsDailyWinner
                                    );
    
            const dailyDistributions = JSON.parse(prizepool.daily_distributions); 
            await this.deletePrizeDistribution(PrizeDistributionsType.daily , prizepool, currentDailyPrizepool[0].id)
            
            const dailyList = await this.generatePrizepoolWinners(dailyDistributions, transactions.raw, prizepool, currentDailyPrizepool[0]);
            const currWinners   = Array.from(dailyDistributions).map((distribution: any, index: number) => {
                const winner = dailyList[index]
                return winner;
            }).filter((winner) => winner);

            await this.createPrizepoolDistributions(currWinners);
            await this.commitWinnerPrize(currWinners, PrizeDistributionsType.daily);
        }

        if ( this.helperService.toDateTime(dayjs(prizepool.end_date)) <= currentTime ) {
            console.log("TRIGGEREDE, herer")
            const userWeeklyWinner      = await this.getPrizepoolDistributionUserIdsByMonth()
            const userIdsWeeklyWinner   = userWeeklyWinner.map(item => item.user_id);
            const weeklyDistributions   = JSON.parse(prizepool.weekly_distributions);
            const startDate             = this.helperService.toDateTime(dayjs(prizepool.start_date));
            const endDate               = this.helperService.toDateTime(dayjs(prizepool.end_date));
            const transactions          = await this.transactionService.getTransactionsByCurrencyAndPeriod(
                'activity_point',
                startDate,
                endDate,
                userIdsWeeklyWinner
            );
            await this.deletePrizeDistribution(PrizeDistributionsType.weekly, prizepool)
            
            const weeklyList = await this.generatePrizepoolWinners(weeklyDistributions, transactions.raw, prizepool);
            const currWinners   = Array.from(weeklyDistributions).map((distribution: any, index: number) => {
                const winner = weeklyList[index]
                return winner;
            }).filter((winner) => winner);
            
            await this.createPrizepoolDistributions(currWinners);
            await this.commitWinnerPrize(currWinners, PrizeDistributionsType.weekly);
            await this.updatePrizepool(prizepool, {is_active: false});
            await this.copyAndCreatePrizepool(prizepool);
            await this.userService.updateForAllUsers({activity_points: 0});
        }

        return true;
    }

    public async mapPrizepoolData (prizepool: Prizepools, dailyPercentage: PrizepoolDailyPercentages | undefined = undefined): Promise<BasePrizepoolResponse> {
        const increment     = await this.getTotalIncrementValue(prizepool);
        const totalSpent    = await this.getTotalPrizepoolReduction(prizepool);
        const initialPool   = (prizepool.total_pools + increment) - totalSpent;
        const totalPool     = dailyPercentage ? Math.ceil( initialPool * dailyPercentage.percentage ) : initialPool;

        return {
            id          : Number(prizepool.id),
            name        : prizepool.name,
            total_pools : totalPool,
            start_date  : dailyPercentage ? `${dailyPercentage.date} 00:00:00` : `${dayjs(prizepool.start_date).format('YYYY-MM-DD')} 00:00:00`,
            end_date    : dailyPercentage ? `${dailyPercentage.date} 23:59:59` : `${dayjs(prizepool.end_date).format('YYYY-MM-DD')} 23:59:59`
        }
    }

    public mapDistributionsData(distribution: PrizepoolDistributions, position: number, activityPoint: number, user: Users | null): BaseLeaderboardResponse {
        return {
            position,
            id                  : Number(distribution.user_id),
            username            : `${distribution.user?.username}`,
            avatar              : Number(distribution.user?.avatar),
            activity_points     : activityPoint,
            distribution_value  : distribution.value,
            is_auth_account     : user?.id == distribution.user_id
        }
    }

    public mapLeaderBoardData(winner: any, position: number, user: Users | null): BaseLeaderboardResponse {
        return {
            position            : winner.position || position,
            id                  : Number(winner.user_id),
            username            : winner.raw.user_username,
            avatar              : winner.raw.user_avatar,
            activity_points     : winner.raw.total_value,
            distribution_value  : winner.value,
            is_auth_account     : user?.id == winner.user_id
        }
    }

    // public async getTransactionsByCurrencyAndPeriodCached(
    //     currency: string,
    //     start: string,
    //     end: string,
    //     userId?: number[],
    //     limit?: number
    //   ): Promise<any> {

    //     const cacheKey = `getTransactionsByCurrencyAndPeriodCached${process.env.REDIS_ENV}:${currency}:${start}_${end}_${limit}`;
      
    //     const cached = await redis.get(cacheKey);
    //     if (cached) {
    //       console.log('✅ From redis cache');
    //       return JSON.parse(cached);
    //     }
      
    //     const result = await this.transactionService.getTransactionsByCurrencyAndPeriod(currency, start, end, userId, limit);
      
    //     // leaderboardCache.set(cacheKey, result);
    //     try {
    //         await redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
    //     } catch (err) {
    //         console.warn('Redis SET error:', err);
    //     }
      
    //     return result;
    // }

    // public async getPrizepoolLeaderboard2(type: PrizeDistributionsType, user: Users | null = null): Promise<PrizepoolLeaderboardResponse> {
    //     const cacheKey = `getPrizepoolLeaderboard:${process.env.REDIS_ENV}:${type}`;

    //     const cached = await redis.get(cacheKey);

    //     if (!cached){
    //         const currentTime   = this.helperService.toDateTime(dayjs());
    //         const prizepool     = await this.fetchLatestActivePrizepool();
            
    //         if (!prizepool) throw Error('No active prizepool exist');

    //         let startDate   = this.helperService.toDateTime(dayjs(prizepool.start_date));
    //         let endDate     = this.helperService.toDateTime(dayjs(prizepool.end_date));

    //         let todayPrizepool: PrizepoolDailyPercentages | undefined;

    //         if (type == PrizeDistributionsType.daily) {
    //             const filtered      = prizepool.dailyPercentages.filter((dailyPercentage) => {
    //                 const start = this.helperService.substractHours(`${dailyPercentage.date} 00:00:00`, 7);
    //                 const end   = this.helperService.substractHours(`${dailyPercentage.date} 23:59:59`, 7);
    //                 if (currentTime >= start && currentTime <= end) {
    //                     return true;
    //                 }
    //                 return false;
    //             }) 

    //             if (filtered.length > 0) {
    //                 todayPrizepool  = filtered[0]; 
    //                 startDate       = this.helperService.substractHours(`${todayPrizepool.date} 00:00:00`, 7);
    //                 endDate         = this.helperService.substractHours(`${todayPrizepool.date} 23:59:59`, 7);
    //             } else {
    //                 const leaderboards: Array<BaseLeaderboardResponse> = [];
    //                 return {
    //                     id          : prizepool.id,
    //                     name        : prizepool.name,
    //                     total_pools : 0,
    //                     start_date  : prizepool.start_date,
    //                     end_date    : prizepool.end_date,
    //                     leaderboards
    //                 }
    //             }
    //         }

    //         let userIdspreviousWinners: number[] = [];
    //         let previousWinners: any[]
    //         if (type == PrizeDistributionsType.daily) {
    //             previousWinners       = await this.getPrizepoolDistributionUserIdsWeek(prizepool.id)
    //             userIdspreviousWinners= previousWinners.map(item => Number(item.user_id));
    //         } else {
    //             previousWinners       = await this.getPrizepoolDistributionUserIdsByMonth()
    //             userIdspreviousWinners= previousWinners.map(item => Number(item.user_id));
    //         }


    //         if (currentTime < startDate || currentTime > endDate) {
    //             throw Error('There is no any prizepool for this week');
    //         }
    //         // const transactions  = await this.getTransactionsByCurrencyAndPeriodCached(
    //         //                         'activity_point',
    //         //                         startDate,
    //         //                         endDate,
    //         //                         userIdspreviousWinners,
    //         //                         10
    //         //                     );
    //         const transactions  = await this.transactionService.getTransactionsByCurrencyAndPeriod(
    //                                 'activity_point',
    //                                 startDate,
    //                                 endDate,
    //                                 userIdspreviousWinners,
    //                                 10
    //                             );
            
    //         const distributions = (type == PrizeDistributionsType.daily) ? 
    //                             JSON.parse(prizepool.daily_distributions) :
    //                             JSON.parse(prizepool.weekly_distributions);

    //         const winnerList    = await this.generatePrizepoolWinners(distributions, transactions.raw, prizepool, todayPrizepool);
    //         const data          = await this.mapPrizepoolData(prizepool, todayPrizepool);

    //         const currWinners   = [] as BaseLeaderboardResponse[]; 
    //         Array.from(distributions).forEach((distribution: any, index: number) => {
    //             const winner = winnerList[index];
    //             if (winner) {
    //                 const data = this.mapLeaderBoardData(winner, index + 1, user);
    //                 currWinners.push(data);
    //             }
    //         });


    //         let authPosition: BaseLeaderboardResponse | undefined;
    //         let authPositionPreviousWinner: BaseLeaderboardPreviousWinnerResponse | undefined;
    //         if (user) {
    //             const foundInTransactions   = winnerList.filter((data) => data.user_id == user.id);
    //             if (foundInTransactions.length > 0) {
    //                 authPosition = {
    //                     position            : foundInTransactions[0].position,
    //                     id                  : foundInTransactions[0].user_id,
    //                     username            : foundInTransactions[0].raw.user_username,
    //                     avatar              : foundInTransactions[0].raw.user_avatar,
    //                     activity_points     : foundInTransactions[0].raw.total_value,
    //                     distribution_value  : foundInTransactions[0].value,
    //                     is_auth_account     : true
    //                 }
    //             }

                
    //             if (userIdspreviousWinners.includes(user.id)) {
    //                 const previousWinner = previousWinners.find(winner => winner.user_id == user.id);
    //                 if (previousWinner) {
    //                     authPositionPreviousWinner = {
    //                         position            : previousWinner.position,
    //                         id                  : user.id,
    //                         avatar              : user.avatar,
    //                         won_prizepool_at    : previousWinner.created_at,
    //                         can_join_again_at   : type === PrizeDistributionsType.daily ? 
    //                             dayjs(prizepool.end_date).add(1, 'day').toISOString() :
    //                             dayjs().endOf('month').add(1, 'day').toISOString()
    //                     }
    //                 }
    //             }
    //         }

    //         let finalData: PrizepoolLeaderboardResponse = Object.assign(data, {
    //             leaderboards: currWinners
    //         });

    //         if (authPosition) {
    //             finalData = { ...finalData, auth_position: authPosition };
    //         }

    //         if (authPositionPreviousWinner) {
    //             finalData = { ...finalData, auth_position_previous_winner: authPositionPreviousWinner}
    //         }

    //         try {
    //             if(type == PrizeDistributionsType.daily){
    //                 await redis.set(cacheKey, JSON.stringify(finalData), 'EX', 60 * REDIS_TTL_DAILY_LEADERBOARD);
    //             } else if(type == PrizeDistributionsType.weekly){
    //                 await redis.set(cacheKey, JSON.stringify(finalData), 'EX', 60 * REDIS_TTL_WEEKLY_LEADERBOARD);
    //             }
    //         } catch (err) {
    //             console.warn('Redis SET error:', err);
    //         }

    //         return finalData
    //     } else {
    //         console.log('✅ From redis cache');
    //         return JSON.parse(cached);
    //     }
    // }

    // public async getPrizepoolLeaderboard(type: PrizeDistributionsType, user: Users | null = null): Promise<PrizepoolLeaderboardResponse> {
    //     const currentTime   = this.helperService.toDateTime(dayjs());
    //     const prizepool     = await this.fetchLatestActivePrizepool();
        
    //     if (!prizepool) throw Error('No active prizepool exist');

    //     let startDate   = this.helperService.toDateTime(dayjs(prizepool.start_date));
    //     let endDate     = this.helperService.toDateTime(dayjs(prizepool.end_date));

    //     let todayPrizepool: PrizepoolDailyPercentages | undefined;

    //     if (type == PrizeDistributionsType.daily) {
    //         const filtered      = prizepool.dailyPercentages.filter((dailyPercentage) => {
    //             const start = this.helperService.substractHours(`${dailyPercentage.date} 00:00:00`, 7);
    //             const end   = this.helperService.substractHours(`${dailyPercentage.date} 23:59:59`, 7);
    //             if (currentTime >= start && currentTime <= end) {
    //                 return true;
    //             }
    //             return false;
    //         }) 

    //         if (filtered.length > 0) {
    //             todayPrizepool  = filtered[0]; 
    //             startDate       = this.helperService.substractHours(`${todayPrizepool.date} 00:00:00`, 7);
    //             endDate         = this.helperService.substractHours(`${todayPrizepool.date} 23:59:59`, 7);
    //         } else {
    //             const leaderboards: Array<BaseLeaderboardResponse> = [];
    //             return {
    //                 id          : prizepool.id,
    //                 name        : prizepool.name,
    //                 total_pools : 0,
    //                 start_date  : prizepool.start_date,
    //                 end_date    : prizepool.end_date,
    //                 leaderboards
    //             }
    //         }
    //     }

    //     let userIdspreviousWinners: number[] = [];
    //     let previousWinners: any[]
    //     if (type == PrizeDistributionsType.daily) {
    //         previousWinners       = await this.getPrizepoolDistributionUserIdsWeek(prizepool.id)
    //         userIdspreviousWinners= previousWinners.map(item => Number(item.user_id));
    //     } else {
    //         previousWinners       = await this.getPrizepoolDistributionUserIdsByMonth()
    //         userIdspreviousWinners= previousWinners.map(item => Number(item.user_id));
    //     }


    //     if (currentTime < startDate || currentTime > endDate) {
    //         throw Error('There is no any prizepool for this week');
    //     }
    //     // const transactions  = await this.getTransactionsByCurrencyAndPeriodCached(
    //     //                         'activity_point',
    //     //                         startDate,
    //     //                         endDate,
    //     //                         userIdspreviousWinners,
    //     //                         10
    //     //                     );
    //     const transactions  = await this.transactionService.getTransactionsByCurrencyAndPeriod(
    //                             'activity_point',
    //                             startDate,
    //                             endDate,
    //                             userIdspreviousWinners,
    //                             10
    //                         );
        
    //     const distributions = (type == PrizeDistributionsType.daily) ? 
    //                         JSON.parse(prizepool.daily_distributions) :
    //                         JSON.parse(prizepool.weekly_distributions);

    //     const winnerList    = await this.generatePrizepoolWinners(distributions, transactions.raw, prizepool, todayPrizepool);
    //     const data          = await this.mapPrizepoolData(prizepool, todayPrizepool);

    //     const currWinners   = [] as BaseLeaderboardResponse[]; 
    //     Array.from(distributions).forEach((distribution: any, index: number) => {
    //         const winner = winnerList[index];
    //         if (winner) {
    //             const data = this.mapLeaderBoardData(winner, index + 1, user);
    //             currWinners.push(data);
    //         }
    //     });


    //     let authPosition: BaseLeaderboardResponse | undefined;
    //     let authPositionPreviousWinner: BaseLeaderboardPreviousWinnerResponse | undefined;
    //     if (user) {
    //         const foundInTransactions   = winnerList.filter((data) => data.user_id == user.id);
    //         if (foundInTransactions.length > 0) {
    //             authPosition = {
    //                 position            : foundInTransactions[0].position,
    //                 id                  : foundInTransactions[0].user_id,
    //                 username            : foundInTransactions[0].raw.user_username,
    //                 avatar              : foundInTransactions[0].raw.user_avatar,
    //                 activity_points     : foundInTransactions[0].raw.total_value,
    //                 distribution_value  : foundInTransactions[0].value,
    //                 is_auth_account     : true
    //             }
    //         }

            
    //         if (userIdspreviousWinners.includes(user.id)) {
    //             const previousWinner = previousWinners.find(winner => winner.user_id == user.id);
    //             if (previousWinner) {
    //                 authPositionPreviousWinner = {
    //                     position            : previousWinner.position,
    //                     id                  : user.id,
    //                     avatar              : user.avatar,
    //                     won_prizepool_at    : previousWinner.created_at,
    //                     can_join_again_at   : type === PrizeDistributionsType.daily ? 
    //                         dayjs(prizepool.end_date).add(1, 'day').toISOString() :
    //                         dayjs().endOf('month').add(1, 'day').toISOString()
    //                 }
    //             }
    //         }
    //     }

    //     let finalData: PrizepoolLeaderboardResponse = Object.assign(data, {
    //         leaderboards: currWinners
    //     });

    //     if (authPosition) {
    //         finalData = { ...finalData, auth_position: authPosition };
    //     }

    //     if (authPositionPreviousWinner) {
    //         finalData = { ...finalData, auth_position_previous_winner: authPositionPreviousWinner}
    //     }

    //     return finalData
    // }

    // public async getPrizepoolLeaderboard(type: PrizeDistributionsType, user: Users | null = null): Promise<PrizepoolLeaderboardResponse> {
    //     const cacheKey = `getPrizepoolLeaderboard:${process.env.REDIS_ENV}:${type}`;
    //     const cached = await redis.get(cacheKey);

    //     const currentTime = this.helperService.toDateTime(dayjs());
    //     const prizepool     = await this.fetchLatestActivePrizepool();
    //     if (!prizepool) throw Error('No active prizepool exist');

    //     let startDate = this.helperService.toDateTime(dayjs(prizepool.start_date));
    //     let endDate = this.helperService.toDateTime(dayjs(prizepool.end_date));
        
    //     let todayPrizepool: PrizepoolDailyPercentages | undefined;

    //     if(cached){
    //         console.log('✅ From redis cache');
    //         const parsed: PrizepoolLeaderboardResponse = JSON.parse(cached);

    //         if (user) {
    //             const userPointRaw = await redis.get(`getPrizepoolLeaderboardUserPoint:${process.env.REDIS_ENV}:${type}:${user.id}`);
    //             if (userPointRaw) {
    //                 const userPoint = JSON.parse(userPointRaw);
    //                 parsed.auth_position = {
    //                     position: userPoint.position,
    //                     id: user.id,
    //                     username: userPoint.username,
    //                     avatar: userPoint.avatar,
    //                     activity_points: userPoint.activity_points,
    //                     distribution_value: userPoint.distribution_value,
    //                     is_auth_account: true
    //                 };

    //                 // Update is_auth_account in leaderboards if user exists
    //                 parsed.leaderboards = parsed.leaderboards.map(leader => {
    //                     if (leader.id === user.id) {
    //                         return { ...leader, is_auth_account: true };
    //                     }
    //                     return leader;
    //                 });
    //             }

    //             const previousWinners = type === PrizeDistributionsType.daily
    //             ? await this.getPrizepoolDistributionUserIdsWeek(prizepool.id)
    //             : await this.getPrizepoolDistributionUserIdsByMonth();

    //             const previousWinner = previousWinners.find(winner => winner.user_id == user.id);
    //             if (previousWinner) {
    //                 parsed.auth_position_previous_winner = {
    //                     position: previousWinner.position,
    //                     id: user.id,
    //                     avatar: user.avatar,
    //                     won_prizepool_at: previousWinner.created_at,
    //                     can_join_again_at: type === PrizeDistributionsType.daily ? 
    //                         dayjs().add(1, 'day').toISOString() :
    //                         dayjs().endOf('month').add(1, 'day').toISOString()
    //                 };
    //             }
    //         }

    //         return parsed;
    //     }

    //     if (type === PrizeDistributionsType.daily) {
    //         const filtered = prizepool.dailyPercentages.filter((dailyPercentage) => {
    //             const start = this.helperService.substractHours(`${dailyPercentage.date} 00:00:00`, 7);
    //             const end = this.helperService.substractHours(`${dailyPercentage.date} 23:59:59`, 7);
    //             return currentTime >= start && currentTime <= end;
    //         });
    
    //         if (filtered.length > 0) {
    //             todayPrizepool = filtered[0];
    //             startDate = this.helperService.substractHours(`${todayPrizepool.date} 00:00:00`, 7);
    //             endDate = this.helperService.substractHours(`${todayPrizepool.date} 23:59:59`, 7);
    //         } else {
    //             return {
    //                 id: prizepool.id,
    //                 name: prizepool.name,
    //                 total_pools: 0,
    //                 start_date: prizepool.start_date,
    //                 end_date: prizepool.end_date,
    //                 leaderboards: []
    //             };
    //         }
    //     }

    //     const previousWinners = type === PrizeDistributionsType.daily
    //     ? await this.getPrizepoolDistributionUserIdsWeek(prizepool.id)
    //     : await this.getPrizepoolDistributionUserIdsByMonth();

    //     const userIdspreviousWinners = previousWinners.map(item => Number(item.user_id));

    //     if (currentTime < startDate || currentTime > endDate) {
    //         throw Error('There is no any prizepool for this week');
    //     }

    //     const transactions = await this.transactionService.getTransactionsByCurrencyAndPeriod(
    //         'activity_point',
    //         startDate,
    //         endDate,
    //         userIdspreviousWinners,
    //         50
    //     );

    //     const distributions = type === PrizeDistributionsType.daily
    //     ? JSON.parse(prizepool.daily_distributions)
    //     : JSON.parse(prizepool.weekly_distributions);

    //     const winnerList    = await this.generatePrizepoolWinners(distributions, transactions.raw, prizepool, todayPrizepool);
    //     const data          = await this.mapPrizepoolData(prizepool, todayPrizepool);

    //     const currWinners   = [] as BaseLeaderboardResponse[]; 
    //     Array.from(distributions).forEach((distribution: any, index: number) => {
    //         const winner = winnerList[index];
    //         if (winner) {
    //             const data = this.mapLeaderBoardData(winner, index + 1, user);
    //             currWinners.push(data);
    //         }
    //     });

    //     let finalData: PrizepoolLeaderboardResponse = Object.assign(data, {
    //         leaderboards: currWinners
    //     });

    //     // save user points to Redis
    //     winnerList.forEach((winner) => {
    //         const key = `getPrizepoolLeaderboardUserPoint:${process.env.REDIS_ENV}:${type}:${winner.user_id}`;
    //         const value = JSON.stringify({
    //             activity_points: winner.raw.total_value,
    //             distribution_value: winner.value,
    //             username: winner.raw.user_username,
    //             avatar: winner.raw.user_avatar,
    //             position: winner.position
    //         });
    //         redis.set(key, value, 'EX', 60 * (
    //             type === PrizeDistributionsType.daily ? REDIS_TTL_DAILY_LEADERBOARD : REDIS_TTL_WEEKLY_LEADERBOARD
    //         ));
    //     });

    //     try {
    //         const ttl = type === PrizeDistributionsType.daily
    //             ? 60 * REDIS_TTL_DAILY_LEADERBOARD
    //             : 60 * REDIS_TTL_WEEKLY_LEADERBOARD;
    //         await redis.set(cacheKey, JSON.stringify(finalData), 'EX', ttl);
    //     } catch (err) {
    //         console.warn('Redis SET error:', err);
    //     }

    //     if (user) {
    //         const found = winnerList.find(data => data.user_id == user.id);
    //         if (found) {
    //             finalData.auth_position = {
    //                 position: found.position,
    //                 id: found.user_id,
    //                 username: found.raw.user_username,
    //                 avatar: found.raw.user_avatar,
    //                 activity_points: found.raw.total_value,
    //                 distribution_value: found.value,
    //                 is_auth_account: true
    //             };
    //         }

    //         if (userIdspreviousWinners.includes(user.id)) {
    //             const previousWinner = previousWinners.find(winner => winner.user_id == user.id);
    //             if (previousWinner) {
    //                 finalData.auth_position_previous_winner = {
    //                     position: previousWinner.position,
    //                     id: user.id,
    //                     avatar: user.avatar,
    //                     won_prizepool_at: previousWinner.created_at,
    //                     can_join_again_at: type === PrizeDistributionsType.daily ?
    //                         dayjs(prizepool.end_date).add(1, 'day').toISOString() :
    //                         dayjs().endOf('month').add(1, 'day').toISOString()
    //                 };
    //             }
    //         }
    //     }

    //     return finalData;
    // }

    public async getPrizepoolLeaderboard(type: PrizeDistributionsType, user: Users | null = null): Promise<PrizepoolLeaderboardResponse> {
        const cacheKey = `getPrizepoolLeaderboard:${process.env.REDIS_ENV}:${type}`;
        const cached = await redis.get(cacheKey);

        const prizepool     = await this.fetchLatestActivePrizepool();
        if (!prizepool) throw Error('No active prizepool exist');

        if(!cached) {
            console.log('✅ From redis cache');
            return {} as PrizepoolLeaderboardResponse;
        }

        console.log('✅ From redis cache');
        const parsed: PrizepoolLeaderboardResponse = JSON.parse(cached);

        if (user) {
            const userPointRaw = await redis.get(`getPrizepoolLeaderboardUserPoint:${process.env.REDIS_ENV}:${type}:${user.id}`);
            if (userPointRaw) {
                const userPoint = JSON.parse(userPointRaw);
                parsed.auth_position = {
                    position: userPoint.position,
                    id: user.id,
                    username: userPoint.username,
                    avatar: userPoint.avatar,
                    activity_points: userPoint.activity_points,
                    distribution_value: userPoint.distribution_value,
                    is_auth_account: true
                };

                // Update is_auth_account in leaderboards if user exists
                parsed.leaderboards = parsed.leaderboards.map(leader => {
                    if (leader.id === user.id) {
                        return { ...leader, is_auth_account: true };
                    }
                    return leader;
                });
            }

            const previousWinners = type === PrizeDistributionsType.daily
            ? await this.getPrizepoolDistributionUserIdsWeek(prizepool.id)
            : await this.getPrizepoolDistributionUserIdsByMonth();

            const previousWinner = previousWinners.find(winner => winner.user_id == user.id);
            if (previousWinner) {
                parsed.auth_position_previous_winner = {
                    position: previousWinner.position,
                    id: user.id,
                    avatar: user.avatar,
                    won_prizepool_at: previousWinner.created_at,
                    can_join_again_at: type === PrizeDistributionsType.daily ? 
                        dayjs(prizepool.end_date).add(1, 'day').toISOString() :
                        dayjs().endOf('month').add(1, 'day').toISOString()
                };
            }
        }

        return parsed;
    }

    public async homePrizepools(): Promise<Object> {
        const prizepool    = await this.fetchLatestActivePrizepool();
        if (!prizepool) return {};

        let initialPool = 0

        const cacheKey = `totalpools:${process.env.REDIS_ENV}`;
        const cached = await redis.get(cacheKey);

        if(cached){
            console.log('✅ From redis cache');
            initialPool = Number(cached)
        }
        
        // const increment     = await this.getTotalIncrementValue(prizepool);
        // const totalSpent    = await this.getTotalPrizepoolReduction(prizepool);
        // const initialPool   = Math.ceil((prizepool.total_pools + increment) - totalSpent);

        if (Number(initialPool) > TRIGGERS.PRIZEPOOL_TOTAL) {
            try {
                await this.notificationService.sendNotificationByCode(NOTIF_CODE.PRIZEPOOL_TOTAL, {total_pool: initialPool});
            } catch (error) {
                console.log("cannot send notif", error);
            }
        }

        let result = {
            id          : prizepool?.id,
            name        : prizepool?.name,
            total_pools : initialPool,
            start_date  : prizepool?.start_date,
            end_date    : prizepool?.end_date 
        }

        return result;
    }

    public async storePrizepoolIncrementLog(schema: PrizepoolIncrementLogPayload) {
        await this.dbConn.getRepository(PrizepoolIncrementLogs)
        .save({
            prizepool_id    : schema.prizepool_id,
            source          : schema.source,
            increment_value : schema.increment_value,
            source_id       : schema.source_id,
            user_id         : schema.user_id,
        });
    }

    public async deletePrizepoolIncrementLogById(prizepoolIncrementLogs: PrizepoolIncrementLogs): Promise <Boolean>{
        await this.dbConn.getRepository(PrizepoolIncrementLogs).update(prizepoolIncrementLogs.id, {
            deleted_at: dayjs().format()
        });

        return true;
    }

    public async getMapWinnersData(user: Users|null, prizepoolId: number, stringDate: string|undefined): Promise<BaseLeaderboardResponse[]> {
        const cacheKey = `getMapWinnersData:${process.env.REDIS_ENV}:${prizepoolId}:${stringDate}`;

        const cached = await redis.get(cacheKey);

        if(!cached) {
            console.log('✅ From redis cache');
            return [] as BaseLeaderboardResponse[];
        }

        console.log('✅ From redis cache');
        let parsed: BaseLeaderboardResponse[] = JSON.parse(cached);

        if(user){
            const userPointRaw = await redis.get(`getMapWinnerDataUserPoint:${process.env.REDIS_ENV}:${prizepoolId}:${stringDate}:${user.id}`);
            if (userPointRaw) {
                parsed = parsed.map(leader => {
                    if (leader.id === user.id) {
                        return { ...leader, is_auth_account: true };
                    }
                    return leader;
                });
            }
        }

        return parsed;

        
    }

    // public async getMapWinnersData(user: Users|null, prizepoolId: number, stringDate: string|undefined): Promise<BaseLeaderboardResponse[]> {
    //     const cacheKey = `getMapWinnersData:${process.env.REDIS_ENV}:${prizepoolId}:${stringDate}`;

    //     const cached = await redis.get(cacheKey);

    //     if (!cached){
    //         const prizepool = await this.fetchPrizepoolById(prizepoolId);
    //         if (!prizepool) throw Error('No Prizepool found!');

    //         let distributions: PrizepoolDistributions[] = [];
    //         let winners: BaseLeaderboardResponse[]      = [];        
            
    //         let startDate: string;
    //         let endDate: string;

    //         if (stringDate) {
    //             const selectedDay   = prizepool.dailyPercentages.filter((percentage) => percentage.date == stringDate);
    //             startDate           = this.helperService.substractHours(`${stringDate}T00:00:00`, 7);
    //             endDate             = this.helperService.substractHours(`${stringDate}T23:59:59`, 7);

    //             if (selectedDay.length > 0) {
    //                 const todayPrizepool = selectedDay[0];
    //                 distributions = prizepool.distributions.filter((distribution) => Number(distribution.prizepool_daily_percentage_id) === Number(todayPrizepool.id));
    //             }
    //         } else {
    //             distributions   = prizepool.distributions.filter((distribution) => !Number(distribution.prizepool_daily_percentage_id));
    //             startDate       = this.helperService.toDateTime(dayjs(prizepool.start_date));
    //             endDate         = this.helperService.toDateTime(dayjs(prizepool.end_date));
    //         }

    //         const transactions  = await this.transactionService.getTransactionsByCurrencyAndPeriod(
    //             'activity_point',
    //             startDate,
    //             endDate,
    //             [],
    //             10
    //         );
            
    //         if (distributions.length > 0) {
    //             distributions.sort((a, b) => b.value - a.value);
    //             const tempWinners = distributions.map((distribution, index) => {
    //                 const filtered = transactions.raw.filter((data) => Number(data.user_id) === Number(distribution.user_id));
    //                 return filtered[0];
    //             }).filter((data) => data);
    //             tempWinners.sort((a, b) => b.total_value - a.total_value);
                
    //             winners = tempWinners.map((data, index) => {
    //                 const filtered = distributions.filter((distribution) => Number(distribution.user_id) === Number(data.user_id));
    //                 return this.mapDistributionsData(filtered[0], filtered[0].position, data.total_value || 0, user);
    //             })
    //         }

    //         try {
    //             await redis.set(cacheKey, JSON.stringify(winners), 'EX', 60 * REDIS_TTL_PRIZEPOOL_WINNER);
    //         } catch (err) {
    //             console.warn('Redis SET error:', err);
    //         }

    //         return winners;
    //     } else {
    //         console.log('✅ From redis cache');
    //         return JSON.parse(cached);
    //     }

        
    // }
    public async getUserParticipations(user: Users, type: PrizeDistributionsType) {
        const participations    = await this.dbConn.getRepository(PrizepoolDistributions)
                                .createQueryBuilder('distributions')
                                .leftJoinAndSelect('distributions.prizepool', 'prizepool')
                                .where('distributions.user_id = :userId', {userId: user.id})
                                .andWhere('distributions.type = :type', {type})
                                .orderBy('distributions.created_at', 'DESC')
                                .getMany();

        return await Promise.all(participations.map(async (participation) => {
            const endDate           = this.helperService.toDateTime(dayjs(participation.created_at));
            const startDate         = (type === PrizeDistributionsType.daily) ? 
                                    this.helperService.substractHours(endDate, 24) :
                                    this.helperService.toDateTime(dayjs(participation.prizepool?.start_date));

            const transactions      = await this.transactionService
                                    .getUserTransactionsByCurrencyAndPeriod(
                                        user, 
                                        TransactionDetailCurrencyEnum.ACTIVITY_POINT,
                                        startDate,
                                        endDate
                                    );

            return {
                prizepool_id        : participation.prizepool_id,
                position            : participation.position || 1,
                date                : dayjs(participation.created_at).subtract(1, 'hours').valueOf(),
                activity_points     : transactions.raw[0].total_value,
                distribution_value  : participation.value
            }
        }));
    }

    public async getPrizepoolDistributionUserIdsWeek(prizepoolId: number): Promise<any[]> {
        const result = await this.dbConn
            .createQueryBuilder()
            .select([
                'prizepool_distributions.user_id AS user_id', 
                'prizepool_distributions.position AS position',
                'prizepool_distributions.created_at AS created_at'
            ])
            .from(PrizepoolDistributions, 'prizepool_distributions')
            .where('prizepool_id = :prizepoolId', { prizepoolId })
            .andWhere('type = :type', { type: 'daily' })
            .groupBy('prizepool_distributions.user_id')
            .addGroupBy('prizepool_distributions.position')
            .addGroupBy('prizepool_distributions.created_at')
            .getRawMany();

        return result.map(row => ({
            user_id: row.user_id,
            position: row.position,
            created_at: row.created_at
        }));
    }

    public async getPrizepoolDistributionUserIdsByMonth(date: string = dayjs().format()): Promise<any[]> {
        // Get start and end of month with substract 7 hours
        const startDate = this.helperService.substractHours(dayjs(date).startOf('month').format('YYYY-MM-DD HH:mm:ss'), 7);
        const endDate = this.helperService.substractHours(dayjs(date).endOf('month').format('YYYY-MM-DD HH:mm:ss'), 7)

        const result = await this.dbConn
            .createQueryBuilder()
            .select([
                'prizepool_distributions.user_id AS user_id',
                'prizepool_distributions.position AS position',
                'prizepool_distributions.created_at AS created_at'
            ])
            .from(PrizepoolDistributions, 'prizepool_distributions')
            .where('prizepool_distributions.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .andWhere('prizepool_distributions.type = :type', { type: 'weekly' })
            .groupBy('prizepool_distributions.user_id')
            .addGroupBy('prizepool_distributions.position')
            .addGroupBy('prizepool_distributions.created_at')
            .getRawMany();

        return result.map(row => ({
            user_id: row.user_id,
            position: row.position,
            created_at: row.created_at
        }));
    }
}
