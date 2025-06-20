import { UserRewardedAds } from "../entities/user-rewarded-ads";
import { RewardedAds } from "../entities/rewarded-ads";
import { BaseService } from "./base";
import { Connection } from "typeorm";
import { TransactionService } from "./transaction";
import { Users } from "../entities/users";
import { REWARDED_ADS_USER_LIMIT, TRANSACTION_DESCRIPTIONS } from "../config/constants";
import dayjs from 'dayjs';
import { UserService } from "./user";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from '../interfaces/requests/transaction';
import { VipService } from './vip';

export class RewardedAdsService extends BaseService {
    protected transactionService    : TransactionService;
    protected userService           : UserService;
    protected vipService            : VipService;

    constructor(conn: Connection) {
        super(conn)
        this.transactionService     = new TransactionService(conn);
        this.userService            = new UserService(conn);
        this.vipService             = new VipService(conn);
    }

    public async getRewardedAds(user: Users): Promise<object> {
        const allItems = await this.dbConn.getRepository(RewardedAds).find({
            where: { is_active: true }
        });

        if (allItems.length === 0) return [];

        const claimCounts = await this.dbConn.getRepository(UserRewardedAds)
        .createQueryBuilder('userRewardedAds')
        .select('userRewardedAds.rewarded_ads_id', 'adsItemId')
        .addSelect('COUNT(*)', 'count')
        .where('userRewardedAds.user_id = :userId', { userId: user.id })
        .andWhere('DATE(userRewardedAds.claimed_at) = :currentTime', { currentTime: dayjs().format('YYYY-MM-DD') })
        .groupBy('userRewardedAds.rewarded_ads_id')
        .getRawMany();

        const claimsMap = Object.fromEntries(
            claimCounts.map(row => [Number(row.adsItemId), Number(row.count)])
        );

        return allItems.map(item => {
            const claimed = claimsMap[item.id] || 0;
            return {
                id: item.id,
                name: item.name,
                position: item.position,
                reward_type: item.reward_type,
                reward_value: item.reward_value,
                claimed_today: claimed,
                remaining_today: Math.max(0, REWARDED_ADS_USER_LIMIT - claimed)
            };
        });
    }

    public async finishingRewardedAdsId(user: Users, rewardedAdsId: number) {
        const rewardedAds = await this.dbConn.getRepository(RewardedAds).findOne({
            where: { id: rewardedAdsId, is_active: true },
        });

        if (!rewardedAdsId) {
            return;
        }

        const claimCount = await this.dbConn.getRepository(UserRewardedAds)
        .createQueryBuilder('userRewardedAds')
        .where('userRewardedAds.user_id = :userId', { userId: user.id })
        .andWhere('userRewardedAds.rewarded_ads_id = :rewardedAdsId', { rewardedAdsId })
        .andWhere('DATE(userRewardedAds.claimed_at) = CURRENT_DATE')
        .getCount();

        if (claimCount >= REWARDED_ADS_USER_LIMIT) {
            return;
        }

        const userRewardAds = new UserRewardedAds();
        userRewardAds.user_id = user.id;
        userRewardAds.rewarded_ads_id = rewardedAdsId;
        userRewardAds.claimed_at = new Date().toISOString();
        await this.dbConn.getRepository(UserRewardedAds).save(userRewardAds);

        const claimedPrizes: Record<string, number> = {
            coupon          : 0,
            activity_point  : 0,
            coin            : 0,
        };

        const reward_value = rewardedAds?.reward_value ?? 0;
        let updateUserPayload: any = {};

        if(rewardedAds?.reward_type == 'coin'){
            updateUserPayload = {
                coins: user.coins + reward_value
            };
            claimedPrizes.coin = reward_value;
        } else if(rewardedAds?.reward_type == 'activity_point'){
            updateUserPayload = {
                activity_points: user.activity_points + reward_value
            };
            claimedPrizes.activity_point = reward_value;
        } else if(rewardedAds?.reward_type == 'coupon'){
            updateUserPayload = {
                coupons: user.coupons + reward_value
            };
            claimedPrizes.coupon = reward_value
        }
        
        await this.userService.update(user, updateUserPayload);

        const extras: any = {
            data: {
                rewarded_ads: {
                    name: rewardedAds?.name
                }
            }
        }
        
        const updatedUser = await this.userService.getUser(user);

        //TRANSACTION
        const transactionPayload = {
            description : TRANSACTION_DESCRIPTIONS.FINISHED_REWARDED_ADS,
            code        : TransactionAvailableCodeEnum.REWARDED_ADS,
            extras      : JSON.stringify(extras),
            details     : Object.keys(claimedPrizes).map((key): TransactionDetailRequest => {
                if (claimedPrizes[key] > 0) {
                    let prevValue   = 0;
                    let currValue   = 0;
                    let typeTrx     = '';
                    switch (key) {
                        case TransactionDetailCurrencyEnum.COIN:
                            typeTrx     = 'CR'
                            prevValue   = user.coins;
                            currValue   = updatedUser?.coins || 0;
                            break;
                        case TransactionDetailCurrencyEnum.COUPON:
                            typeTrx        = 'CR'
                            prevValue   = user.coupons
                            currValue   = updatedUser?.coupons || 0;
                            break;
                        case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                            typeTrx        = 'CR'
                            prevValue   = user.activity_points
                            currValue   = updatedUser?.activity_points || 0;
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

        // VIP USER
        await this.vipService.calculateRewardedAds(user.id);

        // 4. Return hasil
        return {
            is_claimed: true,
            coupon_prize        : claimedPrizes.coupon,
            activity_point_prize: claimedPrizes.activity_point,
            coin_prize          : claimedPrizes.coin
        };
    }
}