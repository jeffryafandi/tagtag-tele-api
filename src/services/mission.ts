import { UserMissions } from "../entities/user-missions";
import { Missions } from "../entities/missions";
import { BaseService } from "./base";
import { Connection, EntityManager  } from "typeorm";
import { GameService } from "./game";
import { v4 as uuidv4 } from 'uuid';
import { TransactionService } from "./transaction";
import { EXTRA_LIFE_PLAY_COUNT_LIMIT, TRANSACTION_DESCRIPTIONS, INVENTORIES_TYPE, REDIS_TTL_USER_MISSION_SESSION, MISSION_PRESET_VIP_ID, MISSION_PRESET_REGULAR_ID } from "../config/constants";
import { GameInventoryService } from "./game_inventory";
import { UserService } from "./user";
import { Users } from "../entities/users";
import dayjs from "dayjs";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest, UserStoreNewTransactionRequest } from "../interfaces/requests/transaction";
import { UserActivityService } from "./user-activity";
import { UserActivityTypeEnum } from "../entities/user-activities";
import redis from './redis';
import { UserMissionsPresets } from "../entities/user-missions-presets";
import { VipService } from './vip';

export class MissionService extends BaseService {
    protected gameService           : GameService;
    protected transactionService    : TransactionService;
    protected gameInventoryService  : GameInventoryService;
    protected userService           : UserService;
    protected vipService            : VipService;
    
    constructor (conn: Connection) {
        super(conn);
        this.gameService            = new GameService(conn);
        this.transactionService     = new TransactionService(conn);
        this.gameInventoryService   = new GameInventoryService(conn);
        this.userService            = new UserService(conn);
        this.vipService             = new VipService(conn);
    }

    public async getMissionList(): Promise<Missions[]> {
        const missions  = this.dbConn.getRepository(Missions)
                        .createQueryBuilder('missions')
                        .where('missions.deleted_at IS NULL')
                        .leftJoinAndSelect('missions.game', 'game')
                        .orderBy('missions.created_at', 'ASC');

        return await missions.getMany();
    }

    public async getMissionById(missionId: number): Promise<Missions | null> {
        const mission = await this.dbConn.getRepository(Missions)
                        .findOne({
                            where: {
                                id: missionId
                            },
                            join: {
                                alias: 'missions',
                                leftJoinAndSelect: {
                                    game: 'missions.game'
                                }
                            }
                        });
        return mission;
    }

    public async getIncompleteMissionList(userId: number): Promise<UserMissions[]> {
        const userMissions  = this.dbConn.getRepository(UserMissions)
                            .createQueryBuilder('userMissions')
                            .leftJoinAndSelect('userMissions.missions', 'missions')
                            .leftJoinAndSelect('missions.game', 'game')
                            .orderBy('userMissions.id', 'DESC')
                            .where('userMissions.user_id = :userId', {userId})
                            .andWhere('userMissions.is_completed = 0');

        return await userMissions.getMany();
    }

    public async getLatestUserMissionByMissionID(user: Users, missionId: number): Promise<UserMissions|null> {
        return await this.dbConn.getRepository(UserMissions)
        .findOne({
            where: {
                user_id: user.id,
                mission_id: missionId
            },
            join: {
                alias: 'userMissions',
                leftJoinAndSelect: {
                    missions: 'userMissions.missions'
                }
            },
            order: {
                created_at: 'DESC'
            }
        });
    }

    public async getLatestUserMissionByMissionCode(session_code: string) {
        return await this.dbConn.getRepository(UserMissions).findOne({
            where: {
                session_code
            },
            order: {
                updated_at: 'DESC'
            }
        })
    }

    public async getCompleteMissionList(): Promise<void> {
        let userMissions        = await this.dbConn.getRepository(UserMissions)
                                .createQueryBuilder('userMissions')
                                .select(['userMissions.session_code', 'userMissions.mission_id', 'userMissions.id', 'userMissions.updated_at', 'userMissions.user_id'])
                                .leftJoinAndSelect('userMissions.missions', 'missions')
                                .addSelect("COUNT(userMissions.session_code)", "totalPlayed")
                                .groupBy('userMissions.session_code')
                                .orderBy('userMissions.updated_at', 'DESC')
                                .where('userMissions.is_completed = 0 AND userMissions.is_claimed = 1')
                                .getRawMany();


        for (const userMission of userMissions) {
            if (userMission.totalPlayed >= userMission.missions_total_stages) {
                const userId        = userMission.userMissions_user_id;
                const sessionCode   = userMission.userMissions_session_code;

                await this.dbConn.getRepository(UserMissions).update({user_id: userId, session_code: sessionCode}, { is_completed : true });
                const isVip = await this.userService.isVip(userId);
                await this.assignInitialMission(userMission.userMissions_user_id, isVip ? MISSION_PRESET_VIP_ID : MISSION_PRESET_REGULAR_ID);
            } 
        }
    }

    public async resetMission(): Promise<void> {
        let userMissionsInComplete        = await this.dbConn.getRepository(UserMissions)
                                .createQueryBuilder('userMissions')
                                .select(['userMissions.session_code', 'userMissions.mission_id', 'userMissions.id', 'userMissions.updated_at', 'userMissions.user_id'])
                                .leftJoinAndSelect('userMissions.missions', 'missions')
                                .addSelect("COUNT(userMissions.session_code)", "totalPlayed")
                                .groupBy('userMissions.session_code')
                                .orderBy('userMissions.updated_at', 'DESC')
                                .where('userMissions.is_completed = 0 AND userMissions.is_claimed = 1 AND userMissions.is_reset = 0')
                                .getRawMany();

        for (const userMission of userMissionsInComplete) {
            if (userMission.totalPlayed >= 1) {
                const userId        = userMission.userMissions_user_id;
                const sessionCode   = userMission.userMissions_session_code;

                await this.dbConn.getRepository(UserMissions).update({user_id: userId, session_code: sessionCode}, { is_completed : true, is_claimed : true, is_reset: true });
                await this.assignMissionToUser(userId, userMission.userMissions_mission_id);
            }
        }
        
    }

    public async getUserMissionsList(userId: number, manager?: EntityManager, useLock: boolean = false): Promise<UserMissions[]> {
        const userMissions  = (manager || this.dbConn).getRepository(UserMissions)
                            .createQueryBuilder('userMissions')
                            .leftJoinAndSelect('userMissions.missions', 'missions')
                            .leftJoinAndSelect('missions.game', 'game')
                            .orderBy('userMissions.id', 'DESC')
                            .where('userMissions.user_id = :userId', {userId});

        if (useLock && manager) {
            console.log("use transaction and locking")
            userMissions.setLock('pessimistic_write');
        }

        return await userMissions.getMany();
    }

    public async getUserMissionsBySessionCode(userId: number, sessionCode: string): Promise<UserMissions[]> {
        const userMissions  = this.dbConn.getRepository(UserMissions)
                            .createQueryBuilder('userMissions')
                            .where('userMissions.user_id = :userId', {userId})
                            .andWhere('userMissions.session_code = :sessionCode', {sessionCode});
        
        return await userMissions.getMany();
    }

    public async getUserMissionByMissionId(userId: number, missionId: number, incomplete: boolean = false): Promise<UserMissions[]> {
        const userMissions  = this.dbConn.getRepository(UserMissions)
                            .createQueryBuilder('userMissions')
                            .where('userMissions.user_id = :userId', {userId})
                            .andWhere('userMissions.mission_id = :missionId', {missionId})
                            .orderBy('userMissions.id', 'DESC')
                            .leftJoinAndSelect('userMissions.missions', 'missions')
                            .leftJoinAndSelect('missions.game', 'game');

        if (incomplete) userMissions.andWhere('userMissions.is_completed = 0');

        return await userMissions.getMany();                        
    }

    public calculateTargetValue(mission: Missions , userMissions: UserMissions[]): number {
        if (userMissions.length < 1) return mission.value;
        return mission.value + Math.round((mission.value * mission.value_scaling) * userMissions.length);
    }

    public calculateCouponPrize(mission: Missions, userMissions: UserMissions[]): number {
        if (userMissions.length < 1) return mission.coupon_prize;
        const prize = mission.coupon_prize + Math.round((mission.coupon_prize * mission.coupon_prize_scaling) * userMissions.length);
        return prize > mission.max_coupon_prize ? mission.max_coupon_prize : prize;
    }

    public calculateActivityPointPrize(mission: Missions, userMissions: UserMissions[]): number {
        if (userMissions.length < 1) return mission.activity_point_prize;
        const prize = mission.activity_point_prize + Math.round((mission.activity_point_prize * mission.activity_point_prize_scaling) * userMissions.length);
        return prize;
    }


    public async getUsersWithIncompleteMission() {
        const result = await this.dbConn.getRepository(UserMissions)
        .createQueryBuilder('userMissions')
        .select('userMissions.user_id', 'user_id')
        .where('userMissions.is_completed = 0')
        .andWhere('userMissions.is_claimed = 0')
        .groupBy('userMissions.user_id')
        .having('count(userMissions.user_id) < 7')
        .getRawMany();

        return result;
    }

    public async insertUserMissionPreset(schema: { user_id: number; preset_id: number }): Promise<UserMissionsPresets | null> {
        const repo = this.dbConn.getRepository(UserMissionsPresets);
    
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

    public async updateUserMissionPreset(user_id: number, new_preset_id: number): Promise<UserMissionsPresets | null> {
        const repo = this.dbConn.getRepository(UserMissionsPresets);
    
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

    public async assignInitialMission(userId: number, preset_id?: number) {
        const games             = await this.gameService.getAllGames(preset_id);
        const missionIdToAssign = games.map((game) => {
            const missions      = game.missions;
            const ids           = missions.map((mission) => mission.id);
            const randomIndex   = this.helperService.getRandomInt(ids.length);

            return ids[randomIndex];
        });

        await Promise.all(missionIdToAssign.map(async (missionId) => {
            await this.assignMissionToUser(userId, missionId);
        }));
    }

    public generateMissionSessionCode(): string {
        return uuidv4();
    }

    public async assignMissionToUser(userId: number, missionId: number, missionSessionCode: string | undefined = undefined): Promise<void> {
        // const sessionCode = missionSessionCode || this.generateMissionSessionCode();
        const redisKey = `user-mission-session-code:${process.env.REDIS_ENV}:${userId}:${missionId}`;
        let sessionCode: string | undefined;

        if (!missionSessionCode) {
            sessionCode = (await redis.get(redisKey)) || undefined;
    
            if (!sessionCode) {
                const generated = this.generateMissionSessionCode();
                // SET NX so that Redis key is only set if it does not exist
                const result = await redis.set(redisKey, generated, 'EX', REDIS_TTL_USER_MISSION_SESSION, 'NX');
                if (result === 'OK') {
                    sessionCode = generated;
                } else {
                    sessionCode = await redis.get(redisKey) || undefined;
                }
            }
        }

        const finalSessionCode = missionSessionCode || sessionCode;

        if (!finalSessionCode) {
            console.log("Failed to obtain session code for mission assignment")
            return;
        }

        console.log(`Using sessionCode for assignment: ${finalSessionCode}`);

        await this.dbConn.transaction('READ COMMITTED', async (manager) => {
            const mission = await this.getMissionById(missionId);
            if (mission) {
                const currentUserMissions       = await this.getUserMissionsList(userId, manager, true);
                const activeMissionInSameGame   = currentUserMissions.filter((userMission) => {
                    return ((userMission.missions?.game_id == mission.game_id) && (!userMission.is_claimed));
                });
                
                // if game of incoming mission is same with the game of in-progress mission: SKIP assignment
                if (activeMissionInSameGame.length > 0) {
                    console.log(activeMissionInSameGame)
                    console.log("SKIP assignment")
                    return;
                }

                let claimed: UserMissions[] = [];
                
                if (missionSessionCode) {
                    console.log(missionSessionCode)
                    console.log("Session Code Exists")
                    claimed = currentUserMissions.filter((userMission) => {
                        return (userMission.session_code == missionSessionCode) && userMission.is_claimed; 
                    });
                }

                if (claimed.length < mission.total_stages) {
                    const existingMission = await manager.getRepository(UserMissions)
                        .findOne({
                            where: {
                                user_id: userId,
                                mission_id: missionId,
                                current_value: 0,
                                session_code: finalSessionCode,
                                is_claimed: false,
                                is_completed: false
                            },
                            lock: { mode: 'pessimistic_write' }
                        });

                    if (!existingMission) {
                        await manager.getRepository(UserMissions).save({
                            user_id              : userId,
                            mission_id           : missionId,
                            target_value         : this.calculateTargetValue(mission, claimed),
                            current_value        : 0,
                            coupon_prize         : this.calculateCouponPrize(mission, claimed),
                            activity_point_prize : this.calculateActivityPointPrize(mission, claimed),
                            coin_prize           : await this.userService.isGopayUser(userId) ? mission.coin_prize_web : mission.coin_prize,
                            stamina_prize        : mission.stamina_prize,
                            session_code         : finalSessionCode
                        });
                    }
                }
            }
        });
    }

    public calculateMaximumCouponTarget(mission: Missions | undefined): number {
        let maxCoupon = 0;
        if (!mission) return maxCoupon;

        for (let c = 0; c < mission.total_stages; c++) {
            const possibleCoupon = mission.coupon_prize + Math.round((mission.coupon_prize * mission.coupon_prize_scaling) * c)
            maxCoupon += (possibleCoupon > mission.max_coupon_prize) ? mission.max_coupon_prize : possibleCoupon
        }
        return maxCoupon;
    }

    public async getUserMissionStatus(user: Users, missionId: number, rewardMultiplier: number) {
        const userMissions = await this.getUserMissionByMissionId(user.id, missionId);
        if (userMissions.length < 1) return {};

        let latestMission   = userMissions[0];
        const played        = userMissions.filter((userMission) => {
            return ((latestMission.session_code === userMission.session_code) && userMission.is_claimed);
        });
        
        const userInventories = await this.gameInventoryService.getUserAllInventories(user.id, dayjs().format())
        const gameInventories = userInventories.map((userInventory) => {
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

        let claimedCoupon       = 0;
        const maxCouponTarget   = this.calculateMaximumCouponTarget(latestMission.missions);
        if (played.length) {
            claimedCoupon = played.reduce((couponValue: number, currentValue: UserMissions) => {
                return couponValue + currentValue.coupon_prize
            }, 0)
        }

        // let coinPrize = (user.stamina < latestMission.stamina_prize && !latestMission.is_watched_ad) ? 0 : latestMission.coin_prize;
        let coinPrize = latestMission.coin_prize;
        const couponPrize       = Math.ceil(this.helperService.toFixNumber(latestMission.coupon_prize * (rewardMultiplier)));
        const activityPrize     = Math.ceil(this.helperService.toFixNumber(latestMission.activity_point_prize * (rewardMultiplier)));

        const data = {
            id                      : missionId,
            description             : latestMission.missions?.description,
            coupon_prize            : couponPrize,
            activity_point_prize    : activityPrize,
            coin_prize              : coinPrize,
            stamina_prize           : latestMission.stamina_prize,
            stamina                 : user.stamina,
            target_value            : latestMission.target_value,
            is_claimed              : latestMission.is_claimed,
            max_coupon_target       : maxCouponTarget,
            current_coupon          : (claimedCoupon < maxCouponTarget) ? claimedCoupon : maxCouponTarget,
            total_played            : played.length,
            total_stages            : latestMission.missions?.total_stages,
            allow_extra_life        : await this.gameService.getUserTotalPlayed(user.id) >= EXTRA_LIFE_PLAY_COUNT_LIMIT,
            highscore               : (!latestMission.missions?.game) ? {} : await this.gameService.getUserHighscoreByGameId(latestMission.missions.game_id, user.id),
            game                    : (!latestMission.missions?.game) ? {} : this.gameService.mapBasicGameObject(latestMission.missions.game),
            game_inventories        : gameInventories
        };

        return data;
    }

    public async updateUserMission(userMission: UserMissions, payload: any) {
        await this.dbConn.getRepository(UserMissions)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where('id = :id', {id: userMission.id})
        .execute();
    }

    public async claimCompletedMission(user: Users, missionId: number) {
        const userMissions  = await this.getUserMissionByMissionId(user.id, missionId)
        if (userMissions.length < 1) return;

        let latestMission   = userMissions[0];
        const played        = userMissions.filter((userMission) => {
            return ((latestMission.session_code === userMission.session_code) && userMission.is_claimed);
        });
        if (latestMission.complete_prize_claimed) return;
        if (played.length < Number(latestMission.missions?.total_stages)) return;
        
        const won           = Number(latestMission.missions?.complete_coin_prize);
        const sessionCode   = latestMission.session_code;
        
        await this.userService.update(user, {coins: user.coins + won});
        const extras: any = {
            data: {
                games: {
                    name: latestMission.missions?.game?.name
                }
            }
        }
        const transactionPayload    = {
            description : TRANSACTION_DESCRIPTIONS.USER_COMPLETE_MISSION,
            code        : TransactionAvailableCodeEnum.PLAY_MISSIONS,
            extras      : JSON.stringify(extras),
            details     : [
                {
                    type            : 'CR',
                    currency        : TransactionDetailCurrencyEnum.COIN,
                    value           : won,
                    previous_value  : user.coins,
                    current_value   : user.coins + won
                }
            ]
        } as UserStoreNewTransactionRequest;

        await this.transactionService.storeUserTransaction(user, transactionPayload);
        await this.dbConn.getRepository(UserMissions).update({user_id: user.id, session_code: sessionCode}, { complete_prize_claimed : true });
    }

    public async resetMissionById(user: Users, missionId: number) {
        const missions = await this.getUserMissionByMissionId(user.id, missionId)

        if (missions.length < 1) return;

        // let sessionCode = await this.dbConn.getRepository(UserMissions)
        //                 .createQueryBuilder('userMissions')
        //                 .where('userMissions.mission_id = :missionId', { missionId: missionId })
        //                 .andWhere('userMissions.user_id = :userId', { userId: user.id })
        //                 .andWhere('userMissions.is_completed = 0')
        //                 .andWhere('userMissions.is_claimed = 1')
        //                 .getRawOne();

        // if (!sessionCode) return;

        // if (missionSessionCode) {
        //     console.log(missionSessionCode)
        //     console.log("Session Code Exists")
        //     claimed = currentUserMissions.filter((userMission) => {
        //         return (userMission.session_code == missionSessionCode) && userMission.is_claimed; 
        //     });
        // }

        // if (claimed.length < mission.total_stages) 

        if(!missions[0].is_claimed) return;

        let userMission = await this.dbConn.getRepository(UserMissions)
                        .createQueryBuilder('userMissions')
                        .leftJoinAndSelect('userMissions.missions', 'missions')
                        .addSelect("COUNT(userMissions.session_code)", "totalPlayed")
                        .where('userMissions.session_code = :sessionCode', { sessionCode: missions[0].session_code })
                        .andWhere('userMissions.user_id = :userId', { userId: missions[0].user_id })
                        .andWhere('userMissions.mission_id = :missionId', { missionId: missions[0].mission_id })
                        .getRawOne();

        if (userMission) {
            if (userMission.totalPlayed >= userMission.missions_total_stages) {
                console.log("reseting mission")
                const userId        = user.id;
                const sessionCode   = userMission.userMissions_session_code;

                await this.dbConn.getRepository(UserMissions).update({user_id: userId, mission_id: missionId, session_code: sessionCode}, { is_completed : true });
                
                await this.assignMissionToUser(userId, missionId);
            }
        }
    }

    public async finishingUserMission(user: Users, missionId: number, progress: any) {
        const missions = await this.getUserMissionByMissionId(user.id, missionId)
        const useExtra = progress?.use_extra_life || false;

        if (missions.length < 1) return;

        const mission = missions[0];
        if (mission.is_claimed) return;

        let rewardMultiplier        = progress.reward_multiplier || 1;
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

        // const isWatchedAd = mission.is_watched_ad;
        // const hasEnoughStamina = user.stamina >= mission.stamina_prize;

        const updatePayload = {
            current_value   : progress.values,
            is_claimed      : progress.values >= mission.target_value
        };

        await this.updateUserMission(mission, updatePayload);

        let session_code = this.helperService.generateUUIDCode();

        if (!useExtra) {
            const latest = await this.gameService.getLatestUserGameScore(user.id);
            if (latest) {
                session_code = latest.session_code || session_code;
            }
        }

        await this.gameService.insertGameScore({
            user_id: mission.user_id,
            game_id: mission.missions?.game_id || 0,
            session_code,
            score: Number(progress.values)
        });

        if (updatePayload.is_claimed) {
            const userInventories   = await this.gameInventoryService.getActiveUserInventories(user, mission.started_at || dayjs().format());
            const ingameInventories = userInventories.filter(inv => inv.gameInventory?.type === INVENTORIES_TYPE.IN_GAME);
            const shopInventories   = userInventories.filter(inv => inv.gameInventory?.type === INVENTORIES_TYPE.SHOP);

            boosterInGame           = this.gameInventoryService.calculateTotalMultiplier(ingameInventories);
            boosterShop             = this.gameInventoryService.calculateTotalMultiplier(shopInventories);
            boosterMultiply         = boosterInGame * boosterShop
            // rewardMultiplier        = rewardMultiplier * boosterMultiply;

            const couponPrize       = Math.ceil(this.helperService.toFixNumber(mission.coupon_prize * (rewardMultiplier * boosterMultiply)));
            const activityPrize     = Math.ceil(this.helperService.toFixNumber(mission.activity_point_prize * (rewardMultiplier * boosterMultiply)));
            const coins             = mission.coin_prize;
            // const coins             = (hasEnoughStamina || isWatchedAd) ? mission.coin_prize * rewardMultiplier : 0;
            // const stamina_prize     = (hasEnoughStamina && !isWatchedAd) ? mission.stamina_prize : 0;

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

            await this.assignMissionToUser(user.id, missionId, mission.session_code);

            claimedPrizes.coupon        = couponPrize;
            claimedPrizes.activity_point= activityPrize;
            claimedPrizes.coin          = coins;
            // claimedPrizes.stamina       = stamina_prize;
        }

        const reducedInventories: any = [];
        if (usedGameInventories.length > 0) {
            usedGameInventories.sort();
            let inventories: any = {};
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
                })

                await this.gameInventoryService.substractUserGameInventory(user.id, key, inventories[key]);
            }));
        }

        const extras: any = {
            data: {
                games: {
                    name: mission.missions?.game?.name
                }
            }
        }
        if (reducedInventories.length > 0) {
            extras.data = {...extras.data, game_inventories: reducedInventories };
        }
        if (boosterMultiply > 1 && updatePayload.is_claimed) {
            extras.data = {...extras.data, booster_multiplier: boosterMultiply };   
        }

        const updatedUser           = await this.userService.getUser(user);
        const transactionPayload    = {
            description : updatePayload.is_claimed ? TRANSACTION_DESCRIPTIONS.FINISHED_MISSION : TRANSACTION_DESCRIPTIONS.PLAY_MISSION,
            code        : TransactionAvailableCodeEnum.PLAY_MISSIONS,
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
                            //     break;
                            // }
                        case TransactionDetailCurrencyEnum.COUPON:
                            typeTrx     = 'CR'
                            prevValue   = user.coupons
                            currValue   = updatedUser?.coupons || 0;
                            break;
                        case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                            typeTrx     = 'CR'
                            prevValue   = user.activity_points
                            currValue   = updatedUser?.activity_points || 0;
                            break;
                        // case TransactionDetailCurrencyEnum.STAMINA:
                        //     if (hasEnoughStamina && !isWatchedAd) {
                        //         typeTrx     = 'DB'
                        //         prevValue   = user.stamina
                        //         currValue   = updatedUser?.stamina || 0;
                        //         break;
                        //     }
                        default:
                            break;
                    }

                    return {
                        type            : typeTrx as "CR" | "DB",
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

        // VIP USER
        await this.vipService.calculateDailyMission(user.id);

        return {
            is_claimed          : updatePayload.is_claimed,
            coupon_prize        : claimedPrizes.coupon,
            activity_point_prize: claimedPrizes.activity_point,
            coin_prize          : claimedPrizes.coin
        }
    }

    public async startUserMission(user: Users, missionId: number): Promise<void> {
        const userMission           = await this.getLatestUserMissionByMissionID(user, missionId);
        const userActivityService   = new UserActivityService(this.dbConn);
        if (!userMission) return;

        // send to userActivities
        await userActivityService.storeNewUserActivity({
            user_id     : user.id,
            logable_id  : userMission.missions?.game_id,
            logable_type: 'games',
            type        : UserActivityTypeEnum.activity,
            description : ''
        });

        await this.updateUserMission(userMission, { started_at: dayjs().format() });
    }

    public async adMissionViewConfirmation(user: Users, missionId: number): Promise<void> {
        const userMission             = await this.getLatestUserMissionByMissionID(user, missionId);
        if (!userMission) return;

        const hasEnoughStamina = user.stamina >= userMission.stamina_prize;

        if(hasEnoughStamina) return;

        await this.updateUserMission(userMission, {is_watched_ad: true});
        return;
    }
}
