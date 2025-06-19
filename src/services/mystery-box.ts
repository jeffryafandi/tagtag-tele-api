import { MysteryBoxes } from "../entities/mystery-boxes";
import { MysteryBoxConfigs } from "../entities/mystery-box-configs";
import { BaseService } from "./base";
import dayjs from "dayjs";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Users } from "../entities/users";
import { TRANSACTION_DESCRIPTIONS } from "../config/constants";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import { Connection } from "typeorm";
import { UserService } from "./user";
import { TransactionService } from "./transaction";

export class MysteryBoxService extends BaseService {
    protected userService       : UserService;
    protected transactionService: TransactionService;
    constructor (conn: Connection) {
        super(conn);
        this.userService        = new UserService(conn);
        this.transactionService = new TransactionService(conn);
    }

    public async fetchActiveConfig(): Promise<MysteryBoxConfigs|null> {
        const now       = dayjs().format();
        const config    = await this.dbConn.getRepository(MysteryBoxConfigs)
        .createQueryBuilder()
        .where('start_date < :now', {now})
        .andWhere('end_date > :now', {now})
        .getOne();

        return config;
    };

    public async fetchFirstBox(filter: {claimedByUserId: number} = {claimedByUserId: 0}) {
        const now   = dayjs().format();
        const query = this.dbConn.getRepository(MysteryBoxes)
        .createQueryBuilder()
        .where('expired_at > :now', {now});

        if (filter.claimedByUserId) {
            query.andWhere('is_claimed = 1');
            query.andWhere('user_id = :userId', {userId: filter.claimedByUserId});
        } else {
            query.andWhere('is_claimed = 0');
        }

        return await query.orderBy('id', 'ASC').limit(1).getOne();
    }

    public async bulkStoreMysteryBoxPrize(data: Array<QueryDeepPartialEntity<MysteryBoxes>>) {
        await this.dbConn.getRepository(MysteryBoxes)
        .createQueryBuilder()
        .insert()
        .into(MysteryBoxes)
        .values(data)
        .execute();
    }

    public async updateMysterBox(boxId: number, schema: QueryDeepPartialEntity<MysteryBoxes>) {
        await this.dbConn.getRepository(MysteryBoxes)
        .createQueryBuilder()
        .update(MysteryBoxes)
        .set(schema)
        .where('id = :boxId', {boxId})
        .execute();
    }

    public async generateDailyBoxes() {
        const existBox  = await this.fetchFirstBox();
        if (existBox) return;

        const config    = await this.fetchActiveConfig();
        if (!config) return;

        const boxes     = [] as Array<QueryDeepPartialEntity<MysteryBoxes>>;
        const dayDiffs  = this.helperService.getDaysDifferences(new Date(config.end_date), new Date(config.start_date));
        const dailyPool = Math.floor(config.total_prize/dayDiffs);
        const dailyDist = JSON.parse(config.daily_distributions);
        const expiredAt = dayjs().add(10, 'hours').format('YYYY-MM-DD') + ' 16:59:59';
        console.log("EXPIRED AT", expiredAt);
        const mappedDist= [...dailyDist].reduce((accumulator: any, currentValue: any) => {
            if (accumulator.length > 0) {
                const previousData          = accumulator[accumulator.length - 1];
                currentValue.total_winners  = (currentValue.total_winners + previousData.total_winners);
            }
            accumulator.push(currentValue);
            return accumulator;
        }, []);

        for (let index = 0; index < config.daily_limit_winners; index++) {
            let currentValue    = 0;
            const filtered      = mappedDist.filter((data: any) => {
                return index < data.total_winners;
            });

            if (filtered.length) {
                const currDist  = filtered[0];
                currentValue    = Math.floor(currDist.value * dailyPool);
            } else {
                let total       = {total_winners: 0, value: 0}
                JSON.parse(config.daily_distributions).map((data: any) => {
                    const value         = data.total_winners * data.value;
                    total.value         += value;
                    total.total_winners += data.total_winners;
                });
                currentValue    = Math.floor(((1- total.value) * dailyPool) / (config.daily_limit_winners - total.total_winners));
            }
            
            boxes.push({
                mystery_box_config_id   : config.id,
                coin                    : currentValue,
                expired_at              : expiredAt
            });
        }

        await this.dbConn.getRepository(Users)
        .createQueryBuilder()
        .update(Users)
        .set({ can_claim_mystery_box: true })
        .where('deleted_at is null')
        .andWhere('can_claim_mystery_box = 0')
        .execute();

        await this.bulkStoreMysteryBoxPrize(boxes);
    }

    public async claimBox(user: Users) {
        if (!user.can_claim_mystery_box) return { is_claimed: false, message: 'User already claim box' };

        const claimedByUser = await this.fetchFirstBox({claimedByUserId: user.id});
        if (claimedByUser) return { is_claimed: false, message: 'User already claim box' };

        // CLAIM HERE
        const unclaimedBox  = await this.fetchFirstBox();
        if (!unclaimedBox) {
            await this.userService.update(user, {
                can_claim_mystery_box   : false
            });

            return { 
                is_claimed      : true, 
                message         : 'Whoops! Too bad you are not winning anything this time. Good luck next time!', 
                coin            : 0,
                coupon          : 0,
                activity_point  : 0
            }
        };

        // update users
        
        const claimedPrizes: Record<string, number> = {
            coin            : unclaimedBox.coin,
            coupon          : unclaimedBox.coupon || 0,
            activity_point  : unclaimedBox.activity_point || 0
        };

        await this.userService.update(user, {
            coupons                 : user.coupons + claimedPrizes.coupon,
            activity_points         : user.activity_points + claimedPrizes.activity_point,
            coins                   : user.coins + claimedPrizes.coin,
            can_claim_mystery_box   : false
        });

        const transactionPayload    = {
            description : TRANSACTION_DESCRIPTIONS.USER_CLAIM_MYSTERY_BOX,
            code        : TransactionAvailableCodeEnum.MYSTERY_BOX,
            extras      : "",
            details     : Object.keys(claimedPrizes).map((key): TransactionDetailRequest => {
                if (claimedPrizes[key] > 0) {
                    let prevValue   = 0;
                    let currValue   = 0;
                    switch (key) {
                        case TransactionDetailCurrencyEnum.COIN:
                            prevValue   = user.coins;
                            currValue   = user.coins + claimedPrizes[key];
                            break;
                        case TransactionDetailCurrencyEnum.COUPON:
                            prevValue   = user.coupons;
                            currValue   = user.coupons + claimedPrizes[key];
                            break;
                        case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                            prevValue   = user.activity_points;
                            currValue   = user.activity_points + claimedPrizes[key];
                            break;
                        default:
                            break;
                    }

                    return {
                        type            : 'CR',
                        currency        : key as TransactionDetailCurrencyEnum,
                        value           : claimedPrizes[key],
                        previous_value  : prevValue,
                        current_value   : currValue,
                    }
                }
                return {} as TransactionDetailRequest
            }).filter((data) => Object.keys(data).length > 0)
        };
        
        await this.transactionService.storeUserTransaction(user, transactionPayload)
        // store to transactions

        await this.updateMysterBox(unclaimedBox.id, { user_id: user.id, is_claimed: true });
        
        return {
            is_claimed      : true,
            coin            : claimedPrizes.coin,
            coupon          : claimedPrizes.coupon,
            activity_point  : claimedPrizes.activity_point
        }
    }
}
