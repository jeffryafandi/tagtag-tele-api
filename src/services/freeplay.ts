import { BaseService } from "./base";
import { Connection } from "typeorm";
import { GameService } from "./game";
import { TransactionService } from "./transaction";
import { UserService } from "./user";
import { AppConfigService } from "./app-config";
import { Users } from "../entities/users";
import { FreeplayFinish } from "../validators/freeplay";
import { TRANSACTION_DESCRIPTIONS } from "../config/constants";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from '../interfaces/requests/transaction';
import { VipService } from './vip';

export class FreeplayService extends BaseService {
    protected gameService           : GameService;
    protected transactionService    : TransactionService;
    protected userService           : UserService;
    protected appConfigService      : AppConfigService;
    protected vipService            : VipService;

    constructor(conn: Connection) {
        super(conn)
        this.gameService            = new GameService(conn);
        this.transactionService     = new TransactionService(conn);
        this.userService            = new UserService(conn);
        this.appConfigService       = new AppConfigService(conn);
        this.vipService             = new VipService(conn);
    }

    public async finishingUserFreeplay(user: Users, gameId: number, progress: FreeplayFinish) {
        const game              = await this.gameService.getGameById(gameId)
        const useExtra          = progress?.use_extra_life || false;
        // const isWatchedAd       = progress.is_watched_ad || false;
        // const hasEnoughStamina  = user.stamina >= (game?.casual_stamina_prize || 0);

        const claimedPrizes: Record<string, number> = {
            coupon          : 0,
            activity_point  : 0,
            // coin            : 0,
            // stamina         : 0 
        };

        const updatePayload = {
            is_claimed: progress.values >= (game?.casual_threshold ?? 0)
        };

        let session_code = this.helperService.generateUUIDCode();

        if (!useExtra) {
            const latest = await this.gameService.getLatestUserGameScore(user.id);
            if (latest) {
                session_code = latest.session_code || session_code;
            }
        }

        const insertedScore = await this.gameService.insertGameScore({
            user_id: user.id,
            game_id: gameId,
            session_code,
            score: Number(progress.values)
        });
        const lastInsertScoreId = insertedScore.id;

        if (updatePayload.is_claimed) {
            const coupon        = game?.casual_coupon_prize;
            const activity_point= game?.casual_activity_point_prize;
            // const coins_prize   = (hasEnoughStamina || isWatchedAd) ? game?.casual_coin_prize : 0;
            // const stamina_prize = (hasEnoughStamina && !isWatchedAd) ? game?.casual_coin_prize : 0;

            const updateUserPayload: any = {
                coupons: user.coupons + (coupon ?? 0),
                activity_points: user.activity_points + (activity_point ?? 0),
                // coins: user.coins,
                // stamina: user.stamina
            };

            // if (hasEnoughStamina || isWatchedAd) {
            //     updateUserPayload.coins += (coins_prize || 0);
            // }

            // if (hasEnoughStamina && !isWatchedAd) {
            //     updateUserPayload.stamina -= (stamina_prize || 0);
            // }

            await this.userService.update(user, updateUserPayload);

            claimedPrizes.coupon        = coupon ?? 0;
            claimedPrizes.activity_point= activity_point ?? 0;
            // claimedPrizes.coin          = coins_prize ?? 0;
            // claimedPrizes.stamina       = stamina_prize ?? 0;
        }

        const extras: any = {
            data: {
                games: {
                    name: game?.name,
                    score: progress.values,
                    user_game_score_id: lastInsertScoreId
                    // is_watched_ad: isWatchedAd
                }
            }
        }

        const updatedUser = await this.userService.getUser(user);
        const transactionPayload = {
            description : updatePayload.is_claimed ? TRANSACTION_DESCRIPTIONS.FINISHED_FREEPLAY : TRANSACTION_DESCRIPTIONS.PLAY_FREEPLAY,
            code        : TransactionAvailableCodeEnum.PLAY_FREEPLAY,
            extras      : JSON.stringify(extras),
            details     : Object.keys(claimedPrizes).map((key): TransactionDetailRequest => {
                if (claimedPrizes[key] > 0) {
                    let prevValue   = 0;
                    let currValue   = 0;
                    let typeTrx     = '';
                    switch (key) {
                        case TransactionDetailCurrencyEnum.COUPON:
                            typeTrx     = 'CR'
                            prevValue   = user.coupons;
                            currValue   = updatedUser?.coupons || 0;
                        case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                            typeTrx     = 'CR'
                            prevValue   = user.activity_points;
                            currValue   = updatedUser?.activity_points || 0;
                        // case TransactionDetailCurrencyEnum.COIN:
                        //     if (hasEnoughStamina || isWatchedAd) {
                        //         typeTrx     = 'CR'
                        //         prevValue   = user.coins;
                        //         currValue   = updatedUser?.coins || 0;
                        //     }
                        //     break;
                        // case TransactionDetailCurrencyEnum.STAMINA:
                        //     if (hasEnoughStamina && !isWatchedAd) {
                        //         typeTrx     = 'DB'
                        //         prevValue   = user.stamina
                        //         currValue   = updatedUser?.stamina || 0;  
                        //     }
                        //     break; 
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

        await this.transactionService.storeUserTransaction(user, transactionPayload);

        // VIP USER
        await this.vipService.calculateFreePlay(user.id);

        return {
            coupon          : claimedPrizes.coupon,
            activity_point  : claimedPrizes.activity_point
            // coin_prize          : claimedPrizes.coin
        }
    }
}
