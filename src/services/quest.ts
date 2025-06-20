import { UserQuests } from "../entities/user-quests";
import { Quests } from "../entities/quests";
import { BaseService } from "./base";
import { Connection } from "typeorm";
import { GameService } from "./game";
import { GameInventoryService } from "./game_inventory";
import { QuestProgress } from "../validators/quest";
import { TransactionService } from "./transaction";
import { EXTRA_LIFE_PLAY_COUNT_LIMIT, TRANSACTION_DESCRIPTIONS, INVENTORIES_TYPE } from "../config/constants";
import { Users } from "../entities/users";
import { UserService } from "./user";
import dayjs from "dayjs";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from '../interfaces/requests/transaction';
import { UserActivityService } from "./user-activity";
import { UserActivityTypeEnum } from "../entities/user-activities";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Games } from "../entities/games";
import { AppConfigService } from "./app-config";
import { APP_CONFIG_KEY } from "../config/app-config-constant";
import { UserQuestsPresets } from "../entities/user-quests-presets";
import { VipService } from './vip';

export class QuestService extends BaseService {
    protected gameService           : GameService;
    protected gameInventoryService  : GameInventoryService;
    protected transactionService    : TransactionService;
    protected userService           : UserService;
    protected appConfigService      : AppConfigService;
    protected vipService            : VipService;

    constructor(conn: Connection) {
        super(conn)
        this.gameService            = new GameService(conn);
        this.gameInventoryService   = new GameInventoryService(conn);
        this.transactionService     = new TransactionService(conn);
        this.userService            = new UserService(conn);
        this.appConfigService       = new AppConfigService(conn);
        this.vipService             = new VipService(conn);
    }

    public async getQuestList(): Promise<Quests[]> {
        const quest = this.dbConn.getRepository(Quests)
                    .createQueryBuilder('quests')
                    .where('quests.deleted_at IS NULL')
                    .leftJoinAndSelect('quests.game', 'game')
                    .orderBy('quests.created_at', 'ASC');

        return await quest.getMany();
    }

    public async getQuestById(questId: number): Promise<Quests|null> {
        const quest = await this.dbConn.getRepository(Quests)
                    .findOne({
                        where: {
                            id: questId
                        },
                        join: {
                            alias: 'quests',
                            leftJoinAndSelect: {
                                game: 'quests.game'
                            }
                        }
                    });
        
        return quest;
    }

    public async getUserQuestList(userId: number): Promise<UserQuests[]> {
        const userQuest = this.dbConn.getRepository(UserQuests)
                        .createQueryBuilder('userQuests')
                        .leftJoinAndSelect('userQuests.quest', 'quest')
                        .leftJoinAndSelect('quest.game', 'game')
                        .where('userQuests.user_id = :userId', {userId})
                        .andWhere('userQuests.is_completed = 0');

        return await userQuest.getMany();
    }

    public async getUsersQuestList(): Promise<UserQuests[]> {
        const userQuest = this.dbConn.getRepository(UserQuests)
                        .createQueryBuilder('userQuests')
                        .leftJoinAndSelect('userQuests.quest', 'quest')
                        .leftJoinAndSelect('quest.game', 'game')
                        .where('userQuests.deleted_at is NULL');

        return await userQuest.getMany();
    }

    public async geClaimedUserQuest(userId: number, questId: number): Promise<UserQuests[]> {
        const userQuest = this.dbConn.getRepository(UserQuests)
                        .createQueryBuilder('userQuests')
                        .where('userQuests.user_id = :userId', {userId})
                        .andWhere('userQuests.quest_id = :questId', {questId})
                        .andWhere('userQUests.is_claimed = 1')
                        .orderBy('userQuests.id', 'DESC')

        return await userQuest.getMany();
    }

    public async getUserQuestListByQuestId(userId: number, questId: number, incomplete: boolean = false): Promise<UserQuests[]> {
        const userQuest = this.dbConn.getRepository(UserQuests)
                        .createQueryBuilder('userQuests')
                        .where('userQuests.user_id = :userId', {userId})
                        .andWhere('userQuests.quest_id = :questId', {questId})
                        .orderBy('userQuests.id', 'DESC')
                        .leftJoinAndSelect('userQuests.quest', 'quest')
                        .leftJoinAndSelect('quest.game', 'game');
        
        if (incomplete) userQuest.andWhere('userQuests.is_claimed = 0');

        return await userQuest.getMany();
    }

    public async getLatestUserQuestByQuestId(user: Users, questId: number): Promise<UserQuests|null> {
        return await this.dbConn.getRepository(UserQuests)
        .findOne({
            where: {
                user_id : user.id,
                quest_id: questId
            },
            join: {
                alias: 'userQuests',
                leftJoinAndSelect: {
                    quest: 'userQuests.quest'
                }
            },
            order: {
                created_at: 'DESC'
            }
        });
    }

    public calculateTargetValue(quest: Quests , userQuests: UserQuests[]): number {
        if (userQuests.length < 1) return quest.value;
        return quest.value + (quest.value * quest.value_scaling) * userQuests.length;
    }

    public calculateCouponPrize(quest: Quests, userQuests: UserQuests[]): number {
        if (userQuests.length < 1) return quest.coupon_prize;
        const prize = quest.coupon_prize + (quest.coupon_prize * quest.coupon_prize_scaling) * userQuests.length;
        return prize > quest.max_coupon_prize ? quest.max_coupon_prize : prize;
    }

    public calculateActivityPointPrize(quest: Quests, userQuests: UserQuests[]): number {
        if (userQuests.length < 1) return quest.activity_point_prize;
        const prize = quest.activity_point_prize + (quest.activity_point_prize * quest.activity_point_prize_scaling) * userQuests.length;
        return prize;
    }

    public async completeClaimedUserQuest(): Promise<void> {
        await this.dbConn.getRepository(UserQuests)
        .createQueryBuilder()
        .where('is_completed = :isCompleted', { isCompleted: false })
        .update()
        .set({is_completed: true})
        .execute();
    }

    public async completeUserQuestByUserId(userId: number): Promise<void> {
        await this.dbConn.getRepository(UserQuests)
        .createQueryBuilder()
        .where('is_completed = :isCompleted', { isCompleted: false })
        .andWhere('user_id = :userId', {userId})
        .update()
        .set({is_completed: true})
        .execute();
    }

    public async insertBulkUserQuest(data: Array<QueryDeepPartialEntity<UserQuests>>) {
        await this.dbConn.getRepository(UserQuests)
        .createQueryBuilder()
        .insert()
        .into(UserQuests)
        .values(data)
        .execute();
    }
    
    // function ini mengabaikan value_scaling, coupon_prize_scaling dan activity_point_prize_scaling jika lebih dari 0
    // saat ini di db itu value_scaling, coupon_prize_scaling dan activity_point_prize_scaling nilai nya 0 semua. jadi aman
    // sementara mencegah DB spike tiap malem
    public async assignQuestsByPresetId(presetId: number, userIds: number[]): Promise<void> {
        const queryRunner = this.dbConn.createQueryRunner();
        await queryRunner.startTransaction();
    
        try {
            await queryRunner.query(`
                INSERT INTO user_quests (
                    user_id, quest_id, target_value, current_value,
                    coupon_prize, activity_point_prize, coin_prize, stamina_prize
                )
                SELECT 
                    uqp.user_id,
                    q.id AS quest_id,
                    q.value AS target_value,
                    0 AS current_value,
                    q.coupon_prize,
                    q.activity_point_prize,
                    CASE
                        WHEN u.gopay_id IS NOT NULL THEN q.coin_prize_web
                        ELSE q.coin_prize
                    END AS coin_prize,
                    q.stamina_prize
                FROM quest_presets qp
                JOIN user_quests_presets uqp ON uqp.preset_id = qp.id
                JOIN quests q ON q.preset_id = qp.id
                JOIN users u ON u.id = uqp.user_id
                WHERE qp.id = ? AND q.deleted_at IS NULL AND uqp.user_id IN (?)
            `, [presetId, userIds]);
    
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
        

    public async assignInitialQuest(userId: any, games: Array<Games> = [], preset_id?: number): Promise<void> {
        if (games.length == 0) {
            games = await this.gameService.getAllGames();
        }

        const userQuestSchemas  = [];
        const currentQuest = await this.getUserQuestList(userId);
        if (currentQuest.length == games.length) {
            console.log("CURRENT QUEST LENGTH FOR USER ID " + userId + " IS ALREADY OKAY!");
            return;
        } else {
            await this.completeUserQuestByUserId(userId);
        }

        for (const game of games) {
            const quests                = game.quests;
            const ids                   = quests.map((quest) => quest.id);
            const questId               = ids[this.helperService.getRandomInt(ids.length)];
            const quest                 = quests.filter((quest) => quest.id == questId);
            let completed: UserQuests[] = [];

            if (quest.length > 0) {
                let target_value        = quest[0].value;
                let coupon_prize        = quest[0].coupon_prize;
                let activity_point_prize= quest[0].activity_point_prize;
                let coin_prize          = await this.userService.isGopayUser(userId) ? quest[0].coin_prize_web : quest[0].coin_prize;
                let stamina_prize       = quest[0].stamina_prize;

                if (quest[0].value_scaling > 0 || quest[0].coupon_prize_scaling || quest[0].activity_point_prize_scaling) {
                    completed           = await this.geClaimedUserQuest(userId, questId);
                    target_value        = this.calculateTargetValue(quest[0], completed);
                    coupon_prize        = this.calculateCouponPrize(quest[0], completed);
                    activity_point_prize= this.calculateActivityPointPrize(quest[0], completed)
                    coin_prize          = await this.userService.isGopayUser(userId) ? quest[0].coin_prize_web : quest[0].coin_prize;
                    stamina_prize       = quest[0].stamina_prize
                }

                userQuestSchemas.push({
                    user_id                 : userId,
                    quest_id                : quest[0].id,
                    target_value            : target_value,
                    current_value           : 0,
                    coupon_prize            : coupon_prize,
                    activity_point_prize    : activity_point_prize,
                    coin_prize              : coin_prize,
                    stamina_prize           : stamina_prize
                });
            }
        }
        console.log("User quest storing for user Id" + userId)
        await this.insertBulkUserQuest(userQuestSchemas);
    }

    public async assignQuestToUser(userId: number, questId: number): Promise<void> {
        const quest = await this.getQuestById(questId);
        if (quest) {
            // const previousUserQuest = await this.getUserQuestListByQuestId(userId, questId);
            const currentUserQuest  = await this.getUserQuestList(userId);
            const questOnSameGame   = currentUserQuest.filter((userQuest) => {
                return ((userQuest.quest?.game?.id === quest.game?.id) && !userQuest.is_claimed);
            });

            // if game of incoming quest is same with the game of in-progress quest: SKIP assignment
            if (questOnSameGame.length > 0) {
                return;
            }

            const completed = currentUserQuest.filter((userQuest) => {
                return ((userQuest.quest?.id === questId) && userQuest.is_claimed);
            });
            
            await this.dbConn.getRepository(UserQuests).save({
                user_id                 : userId,
                quest_id                : questId,
                target_value            : this.calculateTargetValue(quest, completed),
                current_value           : 0,
                coupon_prize            : this.calculateCouponPrize(quest, completed),
                activity_point_prize    : this.calculateActivityPointPrize(quest, completed)
            });
        }
    }

    public async getUserQuestStatus(user: Users, questId: number, rewardMultiplier: number) {
        const quests = await this.getUserQuestListByQuestId(user.id, questId);
        if (quests.length < 1) return {};

        const latestQuest       = quests[0];
        const userInventories   = await this.gameInventoryService.getUserAllInventories(user.id, dayjs().format())
        const gameInventories   = userInventories.map((userInventory) => {
            return {
                id          : userInventory.inventory_id,
                code        : userInventory.gameInventory?.code,
                name        : userInventory.gameInventory?.name,
                value       : userInventory.gameInventory?.value,
                quantity    : userInventory.quantity,
                type        : userInventory.gameInventory?.type,
                expired_at  : userInventory.expired_at ? dayjs(userInventory.expired_at).valueOf() : 0
            };
        });

        // let coinPrize = (user.stamina < latestQuest.stamina_prize && !latestQuest.is_watched_ad) ? 0 : latestQuest.coin_prize;
        const coinPrize = latestQuest.coin_prize;
        const couponPrize       = Math.ceil(this.helperService.toFixNumber(latestQuest.coupon_prize * (rewardMultiplier)));
        const activityPrize     = Math.ceil(this.helperService.toFixNumber(latestQuest.activity_point_prize * (rewardMultiplier)));
        
        const data  = {
            id                   : questId,
            description          : latestQuest.quest?.description,
            coupon_prize         : couponPrize,
            activity_point_prize : activityPrize,
            coin_prize           : coinPrize,
            stamina_prize        : latestQuest.stamina_prize,
            stamina              : user.stamina,
            target_value         : latestQuest.target_value,
            current_value        : latestQuest.current_value,
            is_claimed           : latestQuest.is_claimed,
            allow_extra_life     : await this.gameService.getUserTotalPlayed(user.id) >= EXTRA_LIFE_PLAY_COUNT_LIMIT,
            highscore            : (!latestQuest.quest?.game) ? {} : await this.gameService.getUserHighscoreByGameId(latestQuest.quest.game_id, user.id),
            game                 : (!latestQuest.quest?.game) ? {} : this.gameService.mapBasicGameObject(latestQuest.quest.game),
            game_inventories     : gameInventories
        }

        return data;
    }

    public async updateUserQuest(userQuest: UserQuests, payload: any) {
        await this.dbConn.getRepository(UserQuests)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where('id = :id', {id: userQuest.id})
        .execute();
    }

    public async finishingUserQuestId(user: Users, questId: number, progress: QuestProgress) {
        const quests    = await this.getUserQuestListByQuestId(user.id, questId);
        const useExtra  = progress.use_extra_life || false;

        if (quests.length < 1) return;

        const quest = quests[0];
        if (quest.is_claimed) return;

        const rewardMultiplier        = progress.reward_multiplier || 1;
        let boosterMultiply         = 1;
        let boosterInGame           = 1;
        let boosterShop             = 1;
        const usedGameInventories   = progress.game_inventory_codes || [];
        const claimedPrizes: Record<string, number> = {
            coupon          : 0,
            activity_point  : 0,
            coin            : 0,
            // stamina         : 0 
        };

        // const isWatchedAd = quest.is_watched_ad;
        // const hasEnoughStamina = user.stamina >= quest.stamina_prize;

        const updatePayload = {
            current_value   : progress.values,
            is_claimed      : progress.values >= quest.target_value
        };

        await this.updateUserQuest(quest, updatePayload);

        let session_code = this.helperService.generateUUIDCode();
        if (!useExtra) {
            const latest = await this.gameService.getLatestUserGameScore(user.id);
            if (latest) {
                session_code = latest.session_code || session_code;
            }
        }

        await this.gameService.insertGameScore({
            user_id: quest.user_id,
            game_id: quest.quest?.game_id || 0,
            session_code,
            score: Number(progress.values)
        });

        if (updatePayload.is_claimed) {
            const userInventories   = await this.gameInventoryService.getActiveUserInventories(user, quest.started_at || dayjs().format());
            const ingameInventories = userInventories.filter(inv => inv.gameInventory?.type === INVENTORIES_TYPE.IN_GAME);
            const shopInventories   = userInventories.filter(inv => inv.gameInventory?.type === INVENTORIES_TYPE.SHOP);

            boosterInGame           = this.gameInventoryService.calculateTotalMultiplier(ingameInventories);
            boosterShop             = this.gameInventoryService.calculateTotalMultiplier(shopInventories);
            boosterMultiply         = boosterInGame * boosterShop
            // rewardMultiplier        = rewardMultiplier * boosterMultiply;

            const couponPrize       = Math.ceil(this.helperService.toFixNumber(quest.coupon_prize * (rewardMultiplier * boosterMultiply)));
            const activityPrize     = Math.ceil(this.helperService.toFixNumber(quest.activity_point_prize * (rewardMultiplier * boosterMultiply)));
            const coins             = quest.coin_prize;
            // const coins             = (hasEnoughStamina || isWatchedAd) ? quest.coin_prize * rewardMultiplier : 0;
            // const stamina_prize     = (hasEnoughStamina && !isWatchedAd) ? quest.stamina_prize : 0;

            const updateUserPayload: any = {
                coupons         : user.coupons + couponPrize,
                activity_points : user.activity_points + activityPrize,
                coins           : user.coins + coins
            };
    
            // if (hasEnoughStamina || isWatchedAd) {
            //     updateUserPayload.coins = user.coins + coins;
            // }

            // if (hasEnoughStamina && !isWatchedAd) {
            //     updateUserPayload.stamina = user.stamina - stamina_prize;
            // }

            await this.userService.update(user, updateUserPayload);

            claimedPrizes.coupon        = couponPrize;
            claimedPrizes.activity_point= activityPrize;
            claimedPrizes.coin          = coins;
            // claimedPrizes.stamina       = stamina_prize;
        }

        const reducedInventories: any = [];
        if (usedGameInventories.length > 0) {
            usedGameInventories.sort();
            const inventories: any = {};
            progress.game_inventory_codes.map((code: string) => {
                if (inventories[code]) {
                    inventories[code] = inventories[code] + 1;
                } else {
                    inventories[code] = 1;
                }
            });

            await Promise.all(Object.keys(inventories).map(async (key) => {
                const inventory = await this.gameInventoryService.getInventoryByCode(key);
                reducedInventories.push({
                    id      : inventory?.id,
                    code    : inventory?.code,
                    name    : inventory?.name,
                    value   : inventory?.value,
                    quantity: inventories[key],
                    type    : 'DB'
                });
                await this.gameInventoryService.substractUserGameInventory(user.id, key, inventories[key]);
            }));
        }

        const extras: any = {
            data: {
                games: {
                    name: quest.quest?.game?.name
                }
            }
        }
        if (reducedInventories.length > 0) {
            extras.data = {...extras.data, game_inventories: reducedInventories };
        }
        if (boosterMultiply > 1 && updatePayload.is_claimed) {
            extras.data = {...extras.data, booster_multiplier: boosterMultiply };   
        }

        const updatedUser = await this.userService.getUser(user);

        //TRANSACTION
        const transactionPayload = {
            description : updatePayload.is_claimed ? TRANSACTION_DESCRIPTIONS.FINISHED_QUEST : TRANSACTION_DESCRIPTIONS.PLAY_QUEST,
            code        : TransactionAvailableCodeEnum.PLAY_DAILY_QUEST,
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
                            // if (hasEnoughStamina || isWatchedAd) {
                            //     typeTrx     = 'CR'
                            //     prevValue   = user.coins;
                            //     currValue   = updatedUser?.coins || 0;
                            // }
                        case TransactionDetailCurrencyEnum.COUPON:
                            typeTrx        = 'CR'
                            prevValue   = user.coupons
                            currValue   = updatedUser?.coupons || 0;
                            break;
                        case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                            typeTrx        = 'CR'
                            prevValue   = user.activity_points
                            currValue   = updatedUser?.activity_points || 0;
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
        
        await this.transactionService.storeUserTransaction(user, transactionPayload)

        // VIP USER
        await this.vipService.calculateDailyQuest(user.id);

        return {
            is_claimed          : updatePayload.is_claimed,
            coupon_prize        : claimedPrizes.coupon,
            activity_point_prize: claimedPrizes.activity_point,
            coin_prize          : claimedPrizes.coin
        }
    }

    public async startUserQuest(user: Users, questId: number): Promise<void> {
        const userQuest             = await this.getLatestUserQuestByQuestId(user, questId);
        const userActivityService   = new UserActivityService(this.dbConn);
        if (!userQuest) return;

        // send to userActivities
        await userActivityService.storeNewUserActivity({
            user_id     : user.id,
            logable_id  : userQuest.quest?.game_id,
            logable_type: 'games',
            type        : UserActivityTypeEnum.activity,
            description : ''
        });

        await this.updateUserQuest(userQuest, {started_at: dayjs().format()});
        return;
    }

    public async claimCompletedQuest(user: Users) {
        const userAllQuest = await this.getUserQuestList(user.id);
        const claimedQuest = userAllQuest.filter((userQuest) => {
            return userQuest.is_claimed;
        });

        if (user.complete_quest_claimed) throw Error('You already claimed the prize of completing quest');
        if (claimedQuest.length < userAllQuest.length) throw Error('You haven\'t finish completing the quests');
        
        // fetch from configs
        const configs   = await this.appConfigService.getConfigByKey(APP_CONFIG_KEY.completeQuestPrie);
        if (!configs) throw Error('No Prize available for now');

        const prizes                = JSON.parse(configs?.config_value);
        const claimedPrizes: any    = {};
        Object.keys(prizes).map((key) => {
            if (prizes[key] > 0) {
                const won = prizes[key];
                if (key == TransactionDetailCurrencyEnum.COIN) {
                    claimedPrizes.coins = user.coins + won
                }
                if (key == TransactionDetailCurrencyEnum.COUPON) {
                    claimedPrizes.coupons = user.coupons + won
                }
                if (key == TransactionDetailCurrencyEnum.ACTIVITY_POINT) {
                    claimedPrizes.activity_points = user.activity_points + won
                }
            }
        });
        await this.userService.update(user, {...claimedPrizes, complete_quest_claimed: true});

        const transactionPayload    = {
            description : TRANSACTION_DESCRIPTIONS.USER_COMPLETE_QUEST,
            code        : TransactionAvailableCodeEnum.PLAY_DAILY_QUEST,
            extras      : '',
            details     : Object.keys(prizes).map((key): TransactionDetailRequest => {
                if (prizes[key] > 0) {
                    let prevValue   = 0;
                    let currValue   = 0;
                    const value     = prizes[key];
                    switch (key) {
                        case TransactionDetailCurrencyEnum.COIN:
                            prevValue   = user.coins;
                            currValue   = user.coins + value;
                            break;
                        case TransactionDetailCurrencyEnum.COUPON:
                            prevValue   = user.coupons
                            currValue   = user.coupons + value;
                            break;
                        case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                            prevValue   = user.activity_points
                            currValue   = user.activity_points + value;
                            break;
                        default:
                            break;
                    }
                    return {
                        type            : 'CR',
                        currency        : key as TransactionDetailCurrencyEnum,
                        value           : value,
                        previous_value  : prevValue,
                        current_value   : currValue
                    }
                }
                return {} as TransactionDetailRequest
            }).filter((data) => Object.keys(data).length > 0)
        };

        await this.transactionService.storeUserTransaction(user, transactionPayload);
    }

    public async adQuestViewConfirmation(user: Users, questId: number): Promise<void> {
        const userQuest             = await this.getLatestUserQuestByQuestId(user, questId);
        if (!userQuest) return;

        const hasEnoughStamina = user.stamina >= userQuest.stamina_prize;

        if(hasEnoughStamina) return;

        await this.updateUserQuest(userQuest, {is_watched_ad: true});
        return;
    }

    public async insertUserQuestPreset(schema: { user_id: number; preset_id: number }): Promise<UserQuestsPresets | null> {
        const repo = this.dbConn.getRepository(UserQuestsPresets);
    
        const existing = await repo.findOne({
            where: {
                user_id: schema.user_id,
                preset_id: schema.preset_id,
            },
        });
    
        if (existing) {
            return null;
        }
    
        return await repo.save(schema);
    }

    public async updateUserQuestPreset(user_id: number, new_preset_id: number): Promise<UserQuestsPresets | null> {
        const repo = this.dbConn.getRepository(UserQuestsPresets);
    
        const existing = await repo.findOne({
            where: {
                user_id: user_id
            },
        });
    
        if (!existing) {
            return null;
        }
    
        existing.preset_id = new_preset_id;
        return await repo.save(existing);
    }
    
}
