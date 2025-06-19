import { Users } from "../entities/users";
import { DailyLoginPrizes } from "../entities/daily-login-prizes";
import { DailyLoginUsers } from "../entities/daily-login-users";
import { BaseService } from "./base";
import { Connection, MoreThan } from "typeorm";
import { TransactionService } from "./transaction";
import { UserService } from "./user";
import { DailyLoginService } from "./daily-login";
import { DailyLogins } from "../entities/daily-logins";
import { LUCKY_WHEEL_SPIN_ENTRIES, STAMINA_ENTRIES, REDIS_TTL_TOTAL_POOLS } from '../config/constants';
import { QuestService } from "./quest";
import { NotificationService } from "./fcm-notification";
import { NOTIF_CODE } from "../config/notif-constant";
import { UserQuests } from "../entities/user-quests";
import { RaffleTickets } from "../entities/raffle-tickets";
import { Raffles } from "../entities/raffles";
import { PrizepoolService } from "./prizepool";
import { PrizeDistributionsType } from '../interfaces/requests/prizepool';
import { PrizepoolDailyPercentages } from "../entities/prizepool-daily-percentages";
import { BaseLeaderboardResponse, PrizepoolLeaderboardResponse } from "../interfaces/responses/prizepool";
import { REDIS_TTL_DAILY_LEADERBOARD, REDIS_TTL_WEEKLY_LEADERBOARD, REDIS_TTL_PRIZEPOOL_WINNER } from "../config/constants";
import { PrizepoolDistributions } from "../entities/prizepool-distributions";
import AWS from "aws-sdk";
import dayjs from "dayjs";
import redis from './redis';

export class SchedulerService extends BaseService {
    protected transactionService    : TransactionService;
    protected userService           : UserService;
    protected dailyLoginService     : DailyLoginService;
    protected questService          : QuestService;
    protected notificationService   : NotificationService;
    protected prizepoolService      : PrizepoolService;

    constructor(conn: Connection) {
        super(conn);
        this.transactionService     = new TransactionService(conn);
        this.userService            = new UserService(conn);
        this.dailyLoginService      = new DailyLoginService(conn);
        this.questService           = new QuestService(conn);
        this.notificationService    = new NotificationService(conn);
        this.prizepoolService       = new PrizepoolService(conn);
    }
    
    public async resetLuckyWheel(){
        const schema = { lucky_wheel_spin_entries: LUCKY_WHEEL_SPIN_ENTRIES };

        const updated = await this.dbConn.getRepository(Users)
                        .createQueryBuilder()
                        .update(Users)
                        .set(schema)
                        .where('deleted_at is null')
                        .execute();

        await this.notificationService.sendNotificationByCode(NOTIF_CODE.LUCKY_WHEEL_RESET);
    }

    public async resetClaimedCompleteQuestPrize() {
        await this.dbConn.getRepository(Users)
        .createQueryBuilder()
        .update(Users)
        .set({ complete_quest_claimed: false })
        .where('deleted_at is null')
        .andWhere('complete_quest_claimed = 1')
        .execute();
    }
    
    public async getCurrentDailyLoginUsers(): Promise<DailyLoginUsers[]> {
        const dailyLoginUser    = await this.dbConn.getRepository(DailyLoginUsers)
                                .find({
                                    where: {
                                        is_claimed_today: true,
                                        is_completed    : false
                                    },
                                    join: {
                                        alias: 'dailyLoginUser',
                                        leftJoinAndSelect: {
                                            dailyLoginPrize : 'dailyLoginUser.dailyLoginPrize',
                                            dailyLogin      : 'dailyLoginUser.dailyLogin',
                                            dailyLoginPrizes: 'dailyLogin.dailyLoginPrizes'
                                        }
                                    }
                                });
        return dailyLoginUser;
    }

    //  public async getNextDailyLoginPrize(): Promise<DailyLoginPrizes|null> {
    //     return await this.dbConn.getRepository(DailyLoginPrizes)
    //     .findOne({
    //         where: { id: 'dailyLogin.id' },
    //         order: { created_at: "DESC" },
    //         join: {
    //             alias: 'dailyLoginPrizes',
    //             leftJoinAndSelect: {
    //                 dailyLogin: 'dailyLoginPrizes.dailyLogin',
    //             }
    //         }
    //     });
    // }

    public async createNewDailyLoginUsers(dailyLoginUser: DailyLoginUsers): Promise<DailyLoginUsers[]|any> {
        const newDailyLogin = await this.dbConn.getRepository(DailyLogins)
                            .findOne({
                                where: { id: MoreThan(dailyLoginUser.daily_login_id) },
                                join: {
                                    alias: 'dailyLogins',
                                    leftJoinAndSelect: {
                                        dailyLoginPrizes: 'dailyLogins.dailyLoginPrizes'
                                    }
                                }
                            });

        if (!newDailyLogin) return;

        const prize = newDailyLogin?.dailyLoginPrizes[0]
        await this.dbConn.getRepository(DailyLoginUsers)
        .save({
            user_id             : dailyLoginUser.user_id,
            daily_login_id      : newDailyLogin?.id,
            daily_login_prize_id: prize?.id,
            is_claimed_today    : false,
            is_completed        : false
        });

    }


     public async markDailyLogin(dailyLoginUsers: DailyLoginUsers[]): Promise<void> {
        if (dailyLoginUsers.length == 0) return;    
        // loop users
        const availableDailyLogins: any = [];
        dailyLoginUsers.forEach((user) => {
            if (!availableDailyLogins.includes(user.daily_login_id)) {
                availableDailyLogins.push(user.daily_login_id)
            }
        });

        const availablePrizes = await this.dailyLoginService.getPrizesByDailyLoginIds(availableDailyLogins);
        
        await Promise.all(dailyLoginUsers.map(async (user) => {
            const userPrizes = availablePrizes.filter((prize) => prize.daily_login_id == user.daily_login_id);
            userPrizes.sort((a, b) => b.day - a.day);

            const currentState = userPrizes.filter((prize) => prize.id == user.daily_login_prize_id);
            if (currentState.length > 0) {
                if (currentState[0].day == userPrizes[0].day) {
                    await this.dailyLoginService.update({
                        is_completed: true
                    }, user.id);
                    await this.createNewDailyLoginUsers(user)
                }
                
                if (currentState[0].day < userPrizes[0].day) {
                    userPrizes.sort((a, b) => a.day - b.day);
                    const tomorrow: DailyLoginPrizes[] = [];

                    userPrizes.forEach((prize) => {
                        if (tomorrow.length == 0 && prize.day > currentState[0].day) {
                            tomorrow.push(prize)
                        }
                    });

                    await this.dailyLoginService.update({
                        daily_login_prize_id    :  tomorrow[0].id,
                        is_claimed_today        : false
                    }, user.id);
                }
            }
        }));

        try {
            await this.notificationService.sendNotificationByCode(NOTIF_CODE.CAN_CLAIM_DAILY_LOGIN);
        } catch (error) {
            console.log(error);
        }
    }

    public async resetStamina(){
        const schema = { stamina: STAMINA_ENTRIES };

        const updated = await this.dbConn.getRepository(Users)
                        .createQueryBuilder()
                        .update(Users)
                        .set(schema)
                        .where('deleted_at is null')
                        .execute();

        await this.notificationService.sendNotificationByCode(NOTIF_CODE.STAMINA_RESET);
    }

    public async backupUserQuests(){
        const S3_BUCKET = "2025db-backup";
        const s3 = new AWS.S3();

        const lastMonth = dayjs().subtract(2, "month");
        const dayBefore = dayjs().subtract(2, "day");
        const START_DATE = dayBefore.format("YYYY-MM-DD");
        const END_DATE = `${START_DATE} 23:59:59`;
        const MONTH_NAME = lastMonth.format("MMMM").toLowerCase();
        const BACKUP_NAME = `user_quests_${dayBefore.format("YYYY_MM_DD")}.sql`;

        // console.log(`Backing up data from ${START_DATE} to ${END_DATE}...`);

        // const rows = await this.dbConn.getRepository(UserQuests) 
        //     .createQueryBuilder()
        //     .select('*') 
        //     .where('created_at BETWEEN :startDate AND :endDate', { 
        //         startDate: START_DATE, 
        //         endDate: END_DATE 
        //     }) 
        //     .getRawMany();
      
        // if (rows.length === 0) {
        //     console.log("No data found for backup.");
        //     return;
        // }

        // let sqlDump = rows
        // .map((row: any) => {
        //     const values = Object.values(row)
        //     .map((value) => {
        //         if (value === null || value === undefined) return "NULL"; // NULL tetap NULL tanpa kutip

        //         if (value instanceof Date) {
        //         return `'${dayjs(value).format("YYYY-MM-DD HH:mm:ss")}'`; // Format datetime
        //         }

        //         if (typeof value === "number") {
        //             return value; // Angka tidak dikutip
        //         }

        //         if (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "") {
        //             return value; // String numerik tidak dikutip
        //         }

        //         return `'${value.toString().replace(/'/g, "''")}'`; // String dikutip
        //     })
        //     .join(",");

        //     return `INSERT INTO \`user_quests\` VALUES (${values});`;
        // })
        // .join("\n");


        // console.log("Uploading backup to S3...");
        // await s3
        // .putObject({
        //     Bucket: S3_BUCKET,
        //     Key: BACKUP_NAME,
        //     Body: sqlDump,
        //     ContentType: "application/sql",
        // })
        // .promise();

        // console.log("Backup uploaded successfully.");

        // Hapus data setelah backup
        console.log("Deleting old data...");
        console.log(`from ${START_DATE} to ${END_DATE}...`);
        await this.dbConn.getRepository(UserQuests)
        .createQueryBuilder()
        .delete()
        .from(UserQuests)
        .where('created_at BETWEEN :startDate AND :endDate', { 
            startDate: START_DATE, 
            endDate: END_DATE 
        })
        .execute();

        console.log("Old data deleted successfully.");
    }

    public async backupRaffleTickets() {
        console.log("RUNNING BACKUP.");
        const S3_BUCKET = "2025db-backup";
        const s3 = new AWS.S3();
        const BATCH_SIZE = 1000000

        const now = dayjs();
        const MONTH_NAME = now.format("MMMM").toLowerCase();
        const CURRENT_YEAR = now.year();
        const BASE_NAME = `raffle_tickets_${MONTH_NAME}_${CURRENT_YEAR}`;
        let BACKUP_NAME = `${BASE_NAME}.sql`;

        const getOneRaffle = await this.dbConn
          .getRepository(RaffleTickets)
          .createQueryBuilder("ticket")
          .where("ticket.raffle_prize_id IS NULL")
          .limit(1)
          .getOne();

        if(!getOneRaffle){
            return;
        }

        const activeRaffle = await this.dbConn
        .getRepository(Raffles)
        .createQueryBuilder("ticket")
        .where("id = :id", { id: getOneRaffle.raffle_id })
        .andWhere("is_active=1 AND is_completed=1")
        .getOne();
        if(!activeRaffle){
            return;
        }
    
        // Cek apakah file sudah ada di S3
        let counter = 1;
        while (await this.s3ObjectExists(BACKUP_NAME)) {
          BACKUP_NAME = `${BASE_NAME}_${counter}.sql`;
          counter++;
        }
    
        console.log(`Final backup file name: ${BACKUP_NAME}`);
        console.log(`Starting backup for raffle_tickets without prize...`);
    
        const rows = await this.dbConn
          .getRepository(RaffleTickets)
          .createQueryBuilder("ticket")
          .where("ticket.raffle_prize_id IS NULL")
          .limit(BATCH_SIZE)
          .getRawMany();
    
        if (rows.length === 0) {
          console.log("No data found for backup.");
          return;
        }

        const idList = rows.map((row) => row.ticket_id);
    
        const sqlDump = rows
          .map((row: any) => {
            const values = Object.values(row)
              .map((value) => {
                if (value === null || value === undefined) return "NULL";
                if (value instanceof Date)
                  return `'${dayjs(value).format("YYYY-MM-DD HH:mm:ss")}'`;
                if (typeof value === "number") return value;
                if (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "")
                  return value;
                return `'${value.toString().replace(/'/g, "''")}'`;
              })
              .join(",");
    
            return `INSERT INTO \`raffle_tickets\` VALUES (${values});`;
          })
          .join("\n");
    
        console.log("Uploading backup to S3...");
        await s3
          .putObject({
            Bucket: S3_BUCKET,
            Key: BACKUP_NAME,
            Body: sqlDump,
            ContentType: "application/sql",
          })
          .promise();
    
        console.log("Backup uploaded successfully.");
    
        // Hapus data setelah backup
        console.log("Deleting old data...");
        await this.dbConn
          .getRepository(RaffleTickets)
          .createQueryBuilder()
          .delete()
          .from(RaffleTickets)
          .whereInIds(idList)
          .execute();
    
        console.log("Old data deleted successfully.");
    }
    
    private async s3ObjectExists(key: string): Promise<boolean> {
    const S3_BUCKET = "2025db-backup";
    const s3 = new AWS.S3();
    try {
        await s3
        .headObject({
            Bucket: S3_BUCKET,
            Key: key,
        })
        .promise();
        return true;
    } catch (err: any) {
        if (err.code === "NotFound") return false;
        throw err;
    }
    }

    public async redisSetTotalPools() {
        const prizepool    = await this.prizepoolService.fetchLatestActivePrizepool();
        if (!prizepool) {
            console.log("No active prizepool");
            return {};
        }

        const increment     = await this.prizepoolService.getTotalIncrementValue(prizepool);
        const totalSpent    = await this.prizepoolService.getTotalPrizepoolReduction(prizepool);
        const initialPool   = Math.ceil((prizepool.total_pools + increment) - totalSpent);

        const cacheKey = `totalpools:${process.env.REDIS_ENV}`;

        try {
            await redis.set(cacheKey, initialPool, 'EX', 60 * REDIS_TTL_TOTAL_POOLS);
        } catch (err) {
            console.warn('Redis SET error:', err);
        }
    }

    public async redisSetLeaderboard(type: PrizeDistributionsType, user: Users | null = null) {
        const cacheKey = `getPrizepoolLeaderboard:${process.env.REDIS_ENV}:${type}`;

        const currentTime = this.helperService.toDateTime(dayjs());
        const prizepool     = await this.prizepoolService.fetchLatestActivePrizepool();
        if (!prizepool) throw Error('No active prizepool exist');

        let startDate = this.helperService.toDateTime(dayjs(prizepool.start_date));
        let endDate = this.helperService.toDateTime(dayjs(prizepool.end_date));

        let todayPrizepool: PrizepoolDailyPercentages | undefined;

        if (type === PrizeDistributionsType.daily) {
            const filtered = prizepool.dailyPercentages.filter((dailyPercentage) => {
                const start = this.helperService.substractHours(`${dailyPercentage.date} 00:00:00`, 7);
                const end = this.helperService.substractHours(`${dailyPercentage.date} 23:59:59`, 7);
                return currentTime >= start && currentTime <= end;
            });
    
            if (filtered.length > 0) {
                todayPrizepool = filtered[0];
                startDate = this.helperService.substractHours(`${todayPrizepool.date} 00:00:00`, 7);
                endDate = this.helperService.substractHours(`${todayPrizepool.date} 23:59:59`, 7);
            } else {
                return {
                    id: prizepool.id,
                    name: prizepool.name,
                    total_pools: 0,
                    start_date: prizepool.start_date,
                    end_date: prizepool.end_date,
                    leaderboards: []
                };
            }
        }

        const previousWinners = type === PrizeDistributionsType.daily
        ? await this.prizepoolService.getPrizepoolDistributionUserIdsWeek(prizepool.id)
        : await this.prizepoolService.getPrizepoolDistributionUserIdsByMonth();

        const userIdspreviousWinners = previousWinners.map(item => Number(item.user_id));

        if (currentTime < startDate || currentTime > endDate) {
            throw Error('There is no any prizepool for this week');
        }

        const transactions = await this.transactionService.getTransactionsByCurrencyAndPeriod(
            'activity_point',
            startDate,
            endDate,
            userIdspreviousWinners,
            50
        );

        const distributions = type === PrizeDistributionsType.daily
        ? JSON.parse(prizepool.daily_distributions)
        : JSON.parse(prizepool.weekly_distributions);

        const winnerList    = await this.prizepoolService.generatePrizepoolWinners(distributions, transactions.raw, prizepool, todayPrizepool);
        const data          = await this.prizepoolService.mapPrizepoolData(prizepool, todayPrizepool);

        const currWinners   = [] as BaseLeaderboardResponse[]; 
        Array.from(distributions).forEach((distribution: any, index: number) => {
            const winner = winnerList[index];
            if (winner) {
                const data = this.prizepoolService.mapLeaderBoardData(winner, index + 1, user);
                currWinners.push(data);
            }
        });

        let finalData: PrizepoolLeaderboardResponse = Object.assign(data, {
            leaderboards: currWinners
        });

        // save user points to Redis
        winnerList.forEach((winner) => {
            const key = `getPrizepoolLeaderboardUserPoint:${process.env.REDIS_ENV}:${type}:${winner.user_id}`;
            const value = JSON.stringify({
                activity_points: winner.raw.total_value,
                distribution_value: winner.value,
                username: winner.raw.user_username,
                avatar: winner.raw.user_avatar,
                position: winner.position
            });
            redis.set(key, value, 'EX', 60 * (
                type === PrizeDistributionsType.daily ? REDIS_TTL_DAILY_LEADERBOARD : REDIS_TTL_WEEKLY_LEADERBOARD
            ));
        });

        try {
            const ttl = type === PrizeDistributionsType.daily
                ? 60 * REDIS_TTL_DAILY_LEADERBOARD
                : 60 * REDIS_TTL_WEEKLY_LEADERBOARD;
            await redis.set(cacheKey, JSON.stringify(finalData), 'EX', ttl);
        } catch (err) {
            console.warn('Redis SET error:', err);
        }
    }

    public async redisSetWinnersData(user: Users | null = null) {
        const stringDate = dayjs().format('YYYY-MM-DD');

        const activePrizepool     = await this.prizepoolService.fetchLatestActivePrizepool();
        if (!activePrizepool) throw Error('No active prizepool exist');
        const prizepool = await this.prizepoolService.fetchPrizepoolById(activePrizepool.id);
        if (!prizepool) throw Error('No Prizepool found!');

        const cacheKey = `getMapWinnersData:${process.env.REDIS_ENV}:${prizepool.id}:${stringDate}`;

        let distributions: PrizepoolDistributions[] = [];
        let winners: BaseLeaderboardResponse[]      = [];  
        
        let startDate: string;
        let endDate: string;

        if (stringDate) {
            const selectedDay   = prizepool.dailyPercentages.filter((percentage) => percentage.date == stringDate);
            startDate           = this.helperService.substractHours(`${stringDate}T00:00:00`, 7);
            endDate             = this.helperService.substractHours(`${stringDate}T23:59:59`, 7);

            if (selectedDay.length > 0) {
                const todayPrizepool = selectedDay[0];
                distributions = prizepool.distributions.filter((distribution) => Number(distribution.prizepool_daily_percentage_id) === Number(todayPrizepool.id));
            }
        } else {
            distributions   = prizepool.distributions.filter((distribution) => !Number(distribution.prizepool_daily_percentage_id));
            startDate       = this.helperService.toDateTime(dayjs(prizepool.start_date));
            endDate         = this.helperService.toDateTime(dayjs(prizepool.end_date));
        }

        const transactions  = await this.transactionService.getTransactionsByCurrencyAndPeriod(
            'activity_point',
            startDate,
            endDate
        );
        
        if (distributions.length > 0) {
            distributions.sort((a, b) => b.value - a.value);
            const tempWinners = distributions.map((distribution, index) => {
                const filtered = transactions.raw.filter((data) => Number(data.user_id) === Number(distribution.user_id));
                return filtered[0];
            }).filter((data) => data);
            tempWinners.sort((a, b) => b.total_value - a.total_value);
            
            winners = tempWinners.map((data, index) => {
                const filtered = distributions.filter((distribution) => Number(distribution.user_id) === Number(data.user_id));
                return this.prizepoolService.mapDistributionsData(filtered[0], filtered[0].position, data.total_value || 0, user);
            })

            winners.forEach((winner) => {
                const key = `getMapWinnerDataUserPoint:${process.env.REDIS_ENV}:${prizepool.id}:${stringDate}:${winner.id}`;
                const value = winner.username
                redis.set(key, value, 'EX', 60 * REDIS_TTL_PRIZEPOOL_WINNER);
            });
        }

        try {
            await redis.set(cacheKey, JSON.stringify(winners), 'EX', 60 * REDIS_TTL_PRIZEPOOL_WINNER);
        } catch (err) {
            console.warn('Redis SET error:', err);
        }
    }
}
