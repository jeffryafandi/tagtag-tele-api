import { Users } from "../entities/users";
import { DailyLoginPrizes } from "../entities/daily-login-prizes";
import { DailyLoginUsers } from "../entities/daily-login-users";
import { DailyLogins } from "../entities/daily-logins";
import { BaseService } from "./base";
import { Connection } from "typeorm";
import { TransactionService } from "./transaction";
import { UserService } from "./user";
import { TRANSACTION_AVAILABLE_CODE } from "../config/constants";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import { VipService } from './vip';

export class DailyLoginService extends BaseService {
    protected transactionService: TransactionService;
    protected userService       : UserService;
    protected vipService        : VipService;

    constructor(conn: Connection) {
        super(conn);
        this.transactionService = new TransactionService(conn);
        this.userService        = new UserService(conn);
        this.vipService         = new VipService(conn);
    }

    public async getActiveDailyLogin(): Promise<DailyLogins|null> {
        const dailyLogin = await this.dbConn.getRepository(DailyLogins)
                            .findOne({
                                join: {
                                    alias: 'user',
                                    leftJoinAndSelect: {
                                        dailyLoginPrizes: 'user.dailyLoginPrizes'
                                    }
                                },
                                where: {
                                    is_active: true
                                },
                                order: {
                                    created_at: 'DESC'
                                }
                            });
        return dailyLogin;
    }

    public async getCurrentDailyLoginUser(userId: number): Promise<DailyLoginUsers|null> {
        return await this.dbConn.getRepository(DailyLoginUsers)
        .findOne({
            where: {
                user_id     : userId,
                is_completed: false
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
    }

    public async createNewDailyLoginUser(userId: number): Promise<DailyLoginUsers|null> {
        const prize = await this.dbConn.getRepository(DailyLoginPrizes).createQueryBuilder().orderBy('created_at', 'ASC').getOne();

        await this.dbConn.getRepository(DailyLoginUsers)
        .save({
            user_id             : userId,
            daily_login_id      : prize?.daily_login_id,
            daily_login_prize_id: prize?.id,
            is_claimed_today    : false,
            is_completed        : false
        });

        return await this.getCurrentDailyLoginUser(userId);
    }

    public async userClaimComplete(id: number, value: {claim: boolean, complete: boolean} = {claim: false, complete: false}) {
        const update    = await this.dbConn.getRepository(DailyLoginUsers)
                        .createQueryBuilder()
                        .update(DailyLoginUsers)
                        .set({
                            is_claimed_today: value.claim,
                            is_completed: value.complete
                        })
                        .where('id = :id', {id})
                        .execute();
        return update.affected;
    }

    public async userClaimDailyLogin(user: Users): Promise<void> {
        let currentDailyLoginState = await this.getCurrentDailyLoginUser(user.id);
        
        if (!currentDailyLoginState) {
            currentDailyLoginState = await this.createNewDailyLoginUser(user.id);
        }

        if (currentDailyLoginState?.is_claimed_today || !currentDailyLoginState?.dailyLoginPrize) return;

        const prize         = currentDailyLoginState.dailyLoginPrize;
        const coin          = prize?.coin_prize || 0;
        const coupon        = prize?.coupon_prize || 0;
        const activityPoint = prize?.activity_point_prize || 0;
        const loginPrizes   = currentDailyLoginState?.dailyLogin?.dailyLoginPrizes || []

        await this.userService.update(user, {
            coins           : user.coins + coin,
            coupons         : user.coupons + coupon,
            activity_points : user.activity_points + activityPoint
        });

        const dailyLoginUserPayload = {
            claim   : true,
            complete: false
        };
        
        const updatedUser = await this.userService.getUser(user);

        await this.userClaimComplete(currentDailyLoginState.id, dailyLoginUserPayload);
        const availablePrizes = [
            {
                key     : TransactionDetailCurrencyEnum.COIN, 
                value   : coin || 0
            }, 
            {
                key     : TransactionDetailCurrencyEnum.COUPON,
                value   : coupon || 0
            },
            {
                key     : TransactionDetailCurrencyEnum.ACTIVITY_POINT,
                value   : activityPoint || 0
            }
            
        ];

        const transactionPayload = {
            description : 'User claim daily login',
            code        : TransactionAvailableCodeEnum.DAILY_LOGIN_REWARD,
            extras      : JSON.stringify({
                data    : {
                    daily_login_prizes: {
                        id  : prize?.id, 
                        day : prize?.day
                    }
                }
            }),
            details: availablePrizes.filter((p) => p.value > 0).map((v): TransactionDetailRequest => {
                let prevValue   = 0;
                let currValue   = 0;
                switch (v.key) {
                    case TransactionDetailCurrencyEnum.COIN:
                        prevValue   = user.coins;
                        currValue   = updatedUser?.coins || 0;
                        break;
                    case TransactionDetailCurrencyEnum.COUPON:
                        prevValue   = user.coupons
                        currValue   = updatedUser?.coupons || 0;
                        break;
                    case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                        prevValue   = user.activity_points
                        currValue   = updatedUser?.activity_points || 0;
                        break;
                    default:
                        break;
                }
                return {
                    type            : 'CR',
                    currency        : v.key,
                    value           : v.value,
                    previous_value  : prevValue,
                    current_value   : currValue
                }
            })
        };

        await this.transactionService.storeUserTransaction(user, transactionPayload);

        // VIP USER
        await this.vipService.calculateDailyLogin(user.id);
    }

    public async update(schema: any, dailyLoginUserId: number): Promise<number> {
        const update    = await this.dbConn.getRepository(DailyLoginUsers)
                        .createQueryBuilder()
                        .update(DailyLoginUsers)
                        .set(schema)
                        .where('id = :dailyLoginUserId', {dailyLoginUserId})
                        .execute();

        return update.affected || 0;
    }

    public async getPrizesByDailyLoginIds(dailyLoginIds: string[]) {
        return await this.dbConn.getRepository(DailyLoginPrizes)
        .createQueryBuilder()
        .where("daily_login_id IN(:...ids)", { ids: dailyLoginIds })
        .getMany();
    }
}