import { UserReferralPrizes } from "../entities/user_referral_prizes";
import { Connection } from "typeorm";
import { BaseService } from "./base";
import { TransactionService } from "./transaction";
import { TRANSACTION_AVAILABLE_CODE, TRANSACTION_DESCRIPTIONS } from "../config/constants";
import { UserService } from "./user";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";

export class ReferralService extends BaseService {
    protected transactionService: TransactionService;
    protected userService       : UserService;

    constructor(conn: Connection) {
        super(conn);
        this.transactionService = new TransactionService(conn);
        this.userService        = new UserService(conn);
    }

    public async claimUserReferrals(userId: number): Promise<void> {
        let claimedPrizes: any  = {
            coin    : 0,
            coupon  : 0
        };
        
        const userReferrals     = await this.dbConn.getRepository(UserReferralPrizes)
                                .createQueryBuilder('userReferralServices')
                                .where("user_id = :userId", {userId})
                                .andWhere("is_claimed = :claimed", {claimed: false})
                                .getMany();
 
        userReferrals.forEach((userRef) => {
            claimedPrizes.coin      += userRef.coins
            claimedPrizes.coupon    += userRef.coupons
        });

        const user  = await this.userService.getUserById(userId);
        if (!user) return;

        await this.userService.update(userId, {
            coupons : user.coupons + claimedPrizes.coupon,
            coins   : user.coins + claimedPrizes.coin
        });

        const updatedUser = await this.userService.getUser(user);
        const transactionPayload = {
            description : 'User claim referral Prize',
            code        : TransactionAvailableCodeEnum.REFERRAL_CLAIM,
            extras      : '',
            details     : Object.keys(claimedPrizes).map((key): TransactionDetailRequest => {
                if (claimedPrizes[key] > 0) {
                    let prevValue   = 0;
                    let currValue   = 0;
                    switch (key) {
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
                        currency        : key as TransactionDetailCurrencyEnum,
                        value           : claimedPrizes[key],
                        previous_value  : prevValue,
                        current_value   : currValue
                    }
                }
                return {} as TransactionDetailRequest
            }).filter((data) => Object.keys(data).length > 0)
        };

        await this.transactionService.storeUserTransaction(user, transactionPayload);

        await this.dbConn.getRepository(UserReferralPrizes)
        .createQueryBuilder()
        .update()
        .set({ is_claimed: true })
        .where('user_id = :userId', {userId})
        .execute();
    }
}