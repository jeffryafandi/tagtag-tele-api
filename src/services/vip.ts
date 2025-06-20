import { Connection, In } from "typeorm";
import { BaseService } from "./base";
import { Users } from "../entities/users";
import { VipQuests } from "../entities/vip-quests";
import { UserVipQuests } from "../entities/user-vip-quests";
import { VipMemberships } from "../entities/vip-membership";
import { VipRewards } from "../entities/vip-rewards";
import { UserVipRewards } from "../entities/user-vip-rewards";
import { UserVipPointLogs } from "../entities/user-vip-point-logs";
import { TRANSACTION_DESCRIPTIONS, VIP_QUEST_DAILY_QUEST_ID, VIP_QUEST_DAILY_MISSION_ID, VIP_QUEST_DAILY_WITHDRAW_ID, VIP_QUEST_DAILY_LOGIN_ID, VIP_QUEST_LUCKY_WHEEL_SPIN_ID, VIP_QUEST_DAILY_FREEPLAY_ID, VIP_QUEST_DAILY_RAFFLE_ID, VIP_QUEST_DAILY_REWARDED_ADS_ID } from "../config/constants";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from '../interfaces/requests/transaction';
import dayjs from 'dayjs';
import { UserService } from "./user";
import { TransactionService } from "./transaction";

export class VipService extends BaseService{
    protected userService           : UserService;
    protected transactionService    : TransactionService;
    protected now                   : dayjs.Dayjs = dayjs();
    protected todayDate            : string = '';
    protected startDate            : string = '';
    protected endDate              : string = '';

    constructor(conn: Connection) {
        super(conn)
        this.userService            = new UserService(conn);
        this.transactionService     = new TransactionService(conn);
        this.initializeDates();
    }

    private initializeDates(): void {
        this.now = dayjs();
        this.todayDate = this.now.format('YYYY-MM-DD');
        this.startDate = this.helperService.substractHours(`${this.todayDate} 00:00:00`, 7);
        this.endDate = this.helperService.substractHours(`${this.todayDate} 23:59:59`, 7);
    }

    public async getVipRewards(user: Users): Promise<object> {
        this.initializeDates();
        
        const vipPointDaily = await this.dbConn
            .getRepository(UserVipPointLogs)
            .createQueryBuilder('vp')
            .select('COALESCE(SUM(vp.point), 0)', 'total')
            .where('vp.user_id = :userId', { userId: user.id })
            .andWhere('vp.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        const dailyPoint = parseInt(vipPointDaily?.total || '0', 10);
        const weeklyPoint = user.vip_points;

        const rewards = await this.dbConn.getRepository(VipRewards).find();

        const claimed = await this.dbConn.getRepository(UserVipRewards).find({
            where: { user_id: user.id },
            select: ['vip_reward_id'],
        });

        const claimedIds = new Set(claimed.map(c => c.vip_reward_id));

        const dailyRewards = rewards
            .filter(r => r.reward_type === 'DAILY')
            .map(r => ({
                id: r.id,
                point_threshold: r.point_threshold,
                reward_type: r.reward_type,
                prize_type: r.prize_type,
                prize_value: r.prize_value,
                is_claimed: claimedIds.has(r.id),
            }));

        const weeklyRewards = rewards
            .filter(r => r.reward_type === 'WEEKLY')
            .map(r => ({
                id: r.id,
                point_threshold: r.point_threshold,
                reward_type: r.reward_type,
                prize_type: r.prize_type,
                prize_value: r.prize_value,
                is_claimed: claimedIds.has(r.id),
            }));

        return {
            vip_point_daily: dailyPoint,
            vip_point_weekly: weeklyPoint,
            daily_rewards: dailyRewards,
            weekly_rewards: weeklyRewards,
        };
    }

    //todo
    //kasih reward hadiahnya
    public async finishingVipReward(user: Users, vipRewardId: number) {
        this.initializeDates();
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(user.id, currentTime);

        if(!isVipActive){
            return false;
        }

        const vipRewardRepo = this.dbConn.getRepository(VipRewards);
        const reward = await vipRewardRepo.findOne({ where: { id: vipRewardId } });

        if (!reward) {
            return false;
        }

        let currentPoint = 0;

        if (reward.reward_type == 'DAILY'){
            const vipPointDaily = await this.dbConn
                .getRepository(UserVipPointLogs)
                .createQueryBuilder('vp')
                .select('COALESCE(SUM(vp.point), 0)', 'total')
                .where('vp.user_id = :userId', { userId: user.id })
                .andWhere('vp.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
                .getRawOne();

            currentPoint = parseInt(vipPointDaily?.total || '0', 10);
        } else if (reward.reward_type == 'WEEKLY'){
            currentPoint = user.vip_points;
        }

        if (currentPoint < reward.point_threshold) {
            return false;
        }

        // Cek apakah reward sudah diklaim
        const userRewardRepo = this.dbConn.getRepository(UserVipRewards);
        const alreadyClaimed = await userRewardRepo.findOne({
        where: {
            user_id: user.id,
            vip_reward_id: vipRewardId
        }
        });

        if (alreadyClaimed) {
            return false;
        }

        const claimedPrizes: Record<string, number> = {
            coin            : 0,
            coupon          : 0,
            activity_point  : 0
        };

        // Simpan klaim
        const claim = new UserVipRewards();
        claim.user_id = user.id;
        claim.vip_reward_id = vipRewardId;
        claim.claimed_at = new Date().toISOString();
        claim.is_claimed = true;

        await userRewardRepo.save(claim);

        return {
            status: 200,
            message: 'Reward claimed successfully'
        };
    }

    public async finishingUserVipQuestId(user: Users, questId: number) {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(user.id, currentTime);

        if(!isVipActive){
            return false;
        }

        const quest    = await this.getUserVipQuestByQuestId(user.id, questId);

        if (!quest) return;

        if(quest.completed_at == null || quest.is_claimed) return;

        const claimedPrizes: Record<string, number> = {
            vip_point          : 0
        };

        const updatePayload = {
            is_claimed      : quest.current_value >= quest.target_value
        };

        await this.updateUserVipQuest(quest, updatePayload);

        if (updatePayload.is_claimed) {
            const vip_points = quest.vipQuests?.vip_point_reward ?? 0;

            const updateUserPayload: any = {
                vip_points           : user.vip_points + vip_points
            };

            await this.userService.update(user, updateUserPayload);

            claimedPrizes.vip_point  = vip_points;

            const updatedUser = await this.userService.getUser(user);

            // store to vip_point_logs
            const userVipPointLogsPayload = {
                user_id: user.id,
                vip_quest_id: quest.vipQuests?.id,
                source: 'quest',
                point: claimedPrizes.vip_point
            };
            await this.dbConn.getRepository(UserVipPointLogs).save(userVipPointLogsPayload);

            const extras: any = {
                data: {
                    quest: {
                        name: quest.vipQuests?.name
                    }
                }
            }

            //TRANSACTION
            const transactionPayload = {
                description : updatePayload.is_claimed ? TRANSACTION_DESCRIPTIONS.FINISHED_VIP_QUEST : '',
                code        : TransactionAvailableCodeEnum.VIP_QUEST_REWARD,
                extras      : JSON.stringify(extras),
                details     : Object.keys(claimedPrizes).map((key): TransactionDetailRequest => {
                    if (claimedPrizes[key] > 0) {
                        let prevValue   = 0;
                        let currValue   = 0;
                        let typeTrx     = '';
                        switch (key) {
                            case TransactionDetailCurrencyEnum.VIP_POINT:
                                typeTrx     = 'CR'
                                prevValue   = user.vip_points;
                                currValue   = updatedUser?.vip_points || 0;
                                break;
                            default:
                                break;
                        }

                        return {
                            type            : typeTrx as "CR" | "DB",
                            currency        : key as TransactionDetailCurrencyEnum,
                            value           : claimedPrizes[key],
                            previous_value  : prevValue,
                            current_value   : currValue
                        }
                    }
                    return {} as TransactionDetailRequest
                }).filter((data) => Object.keys(data).length > 0)
            };
            
            await this.transactionService.storeUserTransaction(user, transactionPayload)
        }

        return {
            is_claimed      : updatePayload.is_claimed,
            vip_point_prize : claimedPrizes.vip_point
        }
    }

    public async getVipQuest(user: Users): Promise<object> {
        const userAllQuest = await this.getUserVipQuestList(user.id);
        const claimedQuest = userAllQuest.filter((userVipQuests) => {
            return userVipQuests.is_claimed;
        });

        const mapVipQuest = await Promise.all(userAllQuest.map( async (userVipQuests) => {
            return {
                id              : userVipQuests.vipQuests?.id,
                description     : userVipQuests.vipQuests?.description,
                vip_point_reward: userVipQuests.vipQuests?.vip_point_reward,
                target_value    : userVipQuests.target_value,
                current_value   : userVipQuests.current_value,
                is_claimed      : userVipQuests.is_claimed
            }
        }));

        return {
            is_completed    : claimedQuest.length == userAllQuest.length,
            quests          : mapVipQuest
        };
    }

    public async getUserVipQuestByQuestId(userId: number, questId: number): Promise<UserVipQuests | null> {
        const userVipQuest = this.dbConn.getRepository(UserVipQuests)
                        .createQueryBuilder('userVipQuests')
                        .where('userVipQuests.user_id = :userId', {userId})
                        .andWhere('userVipQuests.vip_quest_id = :questId', {questId})
                        .orderBy('userVipQuests.id', 'DESC')
                        .leftJoinAndSelect('userVipQuests.vipQuests', 'vipQuests')

        return await userVipQuest.getOne();
    }

    public async getUserVipQuestList(userId: number): Promise<UserVipQuests[]> {
        const userQuest = this.dbConn.getRepository(UserVipQuests)
                        .createQueryBuilder('userVipQuests')
                        .leftJoinAndSelect('userVipQuests.vipQuests', 'vipQuests')
                        .where('userVipQuests.user_id = :userId', {userId});

        return await userQuest.getMany();
    }

    public async updateUserVipQuest(userVipQuest: UserVipQuests, payload: any) {
        await this.dbConn.getRepository(UserVipQuests)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where('id = :id', {id: userVipQuest.id})
        .execute();
    }

    public async calculateRewardedAds(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }

        const playRewardedAdsCount = await this.getRewardedAdsCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_DAILY_REWARDED_ADS_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playRewardedAdsCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    }

    public async calculateSubmitRaffle(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }

        const playSubmitRaffleCount = await this.getSubmitRaffleCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_DAILY_RAFFLE_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playSubmitRaffleCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    }

    public async calculateFreePlay(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }

        const playFreePlayCount = await this.getFreePlayCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_DAILY_FREEPLAY_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playFreePlayCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    }

    public async calculateLuckyWheelSpin(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }

        const playLuckyWheelSpinCount = await this.getLuckyWheelSpinCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_LUCKY_WHEEL_SPIN_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playLuckyWheelSpinCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    }

    public async calculateDailyLogin(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }

        const playDailyLoginCount = await this.getDailyLoginCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_DAILY_LOGIN_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playDailyLoginCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    }

    public async calculateWithdraw(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }

        const playWithdrawCount = await this.getWithdrawCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_DAILY_WITHDRAW_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playWithdrawCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    }

    public async calculateDailyMission(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }

        const playMissionCount = await this.getDailyMissionCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_DAILY_MISSION_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playMissionCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    } 

    public async calculateDailyQuest(userId: number): Promise<boolean> {
        const currentTime    = this.helperService.toDateTime(dayjs());
        const isVipActive = await this.isVipActive(userId, currentTime);

        if(!isVipActive){
            return false;
        }
        
        const playQuestCount = await this.getDailyQuestCount(userId)

        const userVipQuests = await this.dbConn.getRepository(UserVipQuests).find({
            where: {
              user_id: userId,
              vip_quest_id: In(VIP_QUEST_DAILY_QUEST_ID),
              is_claimed: false,
            },
        });

        if(!userVipQuests) return false;

        for (const quest of userVipQuests) {
            const newValue = Math.min(quest.target_value, playQuestCount);
    
            if (newValue !== quest.current_value) {
                quest.current_value = newValue;
    
                if (quest.current_value === quest.target_value) {
                    quest.completed_at = new Date().toISOString();
                }
    
                await this.dbConn.getRepository(UserVipQuests).save(quest);
            }
        }

        return true;
    }

    public async isVipActive(userId: number, time: string = ''): Promise<boolean> {
        const vipMembership = await this.dbConn.getRepository(VipMemberships)
            .createQueryBuilder('vipMembership')
            .where('vipMembership.user_id = :userId', { userId })
            .andWhere('vipMembership.expired_at > :time', { time })
            .getOne();

        return vipMembership !== null;
    }

    public async getRewardedAdsCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: TRANSACTION_DESCRIPTIONS.FINISHED_REWARDED_ADS })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.REWARDED_ADS })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }

    public async getSubmitRaffleCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: TRANSACTION_DESCRIPTIONS.SUBMIT_RAFFLE })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.RAFFLE_REWARD })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }

    public async getFreePlayCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: TRANSACTION_DESCRIPTIONS.FINISHED_FREEPLAY })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.PLAY_FREEPLAY })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }

    public async getLuckyWheelSpinCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: TRANSACTION_DESCRIPTIONS.WON_LUCKY_WHEEL })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.LUCKY_WHEEL_REWARD })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }

    public async getDailyLoginCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: 'User claim daily login' })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.DAILY_LOGIN_REWARD })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }

    public async getWithdrawCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: TRANSACTION_DESCRIPTIONS.USER_WITHDRAW })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.USER_WITHDRAW })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }

    public async getDailyMissionCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: TRANSACTION_DESCRIPTIONS.FINISHED_MISSION })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.PLAY_MISSIONS })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }

    public async getDailyQuestCount(userId: number): Promise<number> {
        this.initializeDates();
        const result = await this.dbConn
            .createQueryBuilder()
            .select('COUNT(*)', 'count')
            .from('transactions', 'transactions')
            .where('transactions.user_id = :userId', { userId })
            .andWhere('transactions.description = :description', { description: TRANSACTION_DESCRIPTIONS.FINISHED_QUEST })
            .andWhere('transactions.code = :code', { code: TransactionAvailableCodeEnum.PLAY_DAILY_QUEST })
            .andWhere('transactions.created_at BETWEEN :startDate and :endDate', {startDate: this.startDate, endDate: this.endDate})
            .getRawOne();

        return parseInt(result?.count || '0');
    }
}