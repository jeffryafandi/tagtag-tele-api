import { BaseService } from "./base";
import { Connection, DeepPartial, LessThan, MoreThan } from "typeorm";
import { GameInventoryService } from "./game_inventory";
import { TransactionService } from "./transaction";
import { TRANSACTION_AVAILABLE_CODE, LUCKY_WHEEL_SPIN_ENTRIES, BOOSTER_DURATION, TRANSACTION_DESCRIPTIONS, ROWS_PER_PAGE_LUCKY_WHEEL } from "../config/constants";
import { Users } from "../entities/users";
import { LuckyWheels, LuckyWheelsUpdateable } from "../entities/lucky-wheels";
import { LuckyWheelSessions } from "../entities/lucky-wheel-sessions";
import { LuckyWheelSessionPrizes } from "../entities/lucky-wheel-session-prizes";
import { LuckyWheelPrizes, LuckyWheelPrizesUpdateable } from "../entities/lucky-wheel-prizes";
import { UserService } from "./user";
import { Transactions } from "../entities/transactions";
import dayjs from "dayjs";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import { CreateLuckyWheelPrizes, CreateLuckyWheels, FilterLuckyWheels, UpdateLuckyWheelPrizes, UpdateLuckyWheels } from "../interfaces/requests/lucky-wheels";
import { ROWS_PER_PAGE } from "../config/constants";
import underscore, { groupBy } from 'underscore';
import { AppConfigService } from "./app-config";
import { APP_CONFIG_KEY } from "../config/app-config-constant";
import { json } from "stream/consumers";
import { VipService } from './vip';


export class LuckyWheelsService extends BaseService {
    protected userService           : UserService;
    protected transactionService    : TransactionService;
    protected gameInventoryService  : GameInventoryService;
    protected appConfigService      : AppConfigService;
    protected vipService            : VipService;

    constructor(conn: Connection) {
        super(conn)
        this.userService            = new UserService(conn);
        this.transactionService     = new TransactionService(conn);
        this.gameInventoryService   = new GameInventoryService(conn);
        this.appConfigService       = new AppConfigService(conn);
        this.vipService             = new VipService(conn);
    }

    public async getLuckyWheelsSessionByUserId(user: Users): Promise<LuckyWheelSessions[]>{
       return await this.dbConn.getRepository(LuckyWheelSessions)
                    .createQueryBuilder("luckyWheelSessions")
                    .leftJoinAndSelect("luckyWheelSessions.luckyWheels", "luckyWheels")
                    .leftJoinAndSelect("luckyWheels.luckyWheelPrizes", "luckyWheelPrizes")
                    .leftJoinAndSelect("luckyWheelSessions.luckyWheelSessionPrizes", "luckyWheelSessionPrizes")
                    .leftJoinAndSelect("luckyWheelPrizes.gameInventory", "gameInventory")
                    .where('luckyWheelSessions.deleted_at IS NULL')
                    .andWhere('luckyWheelSessions.is_completed = 0')
                    .andWhere("luckyWheelSessions.user_id = :userId", {userId: user.id})
                    .getMany();
    }

    public async getLuckyWheels(user: Users): Promise<object | undefined> {
        let luckyWheelSessions = await this.getLuckyWheelsSessionByUserId(user);
        
        if(luckyWheelSessions.length == 0 ){
            await this.createNewLuckyWheelSessions(user.id);
            luckyWheelSessions  = await this.getLuckyWheelsSessionByUserId(user);
        }

        const session = luckyWheelSessions[0];
        console.log(session)
        const mappedLuckyWheels = session.luckyWheels?.luckyWheelPrizes?.map((prize) => {
            return {
                id                   : prize.id,
                coupon_prize         : prize.coupon_prize,
                coin_prize           : prize.coin_prize,
                spin_entries         : prize.lucky_wheel_spin_entry_prize,
                activity_point_prize : prize.activity_point_prize,
                game_inventory       : prize.game_inventory_id ? {
                    id               : prize.game_inventory_id,
                    code             : prize.gameInventory?.code,
                    name             : prize.gameInventory?.name,
                } : {},
                is_claimed           : (session.luckyWheelSessionPrizes?.filter((claimedPrize) => claimedPrize.lucky_wheel_prize_id == prize.id)?.length || 0) > 0
            };
        })

        return mappedLuckyWheels;
    }

    public async createNewLuckyWheelSessions(userId: number): Promise<LuckyWheelSessions> {
        const luckyWheel    = await this.dbConn.getRepository(LuckyWheels)
                            .findOne({
                                where:{
                                    is_active: true
                                },
                                order: {
                                    created_at: 'ASC'
                                }
                            });

       return await this.dbConn.getRepository(LuckyWheelSessions)
        .save({
            user_id           : userId,
            lucky_wheel_id    : luckyWheel?.id,
        });

    }

    public async addCurrentLuckyWheelSessions(luckyWheelSession: LuckyWheelSessions): Promise<LuckyWheelSessions> {
        const luckyWheel    = await this.dbConn.getRepository(LuckyWheels)
                            .findOne({
                                where: { 
                                    id: luckyWheelSession.lucky_wheel_id,
                                    is_active: true 
                                }
                            });

       return await this.dbConn.getRepository(LuckyWheelSessions)
        .save({
            user_id           : luckyWheelSession.user_id,
            lucky_wheel_id    : luckyWheel?.id,
        });

    }

    public async addNewLuckyWheelSessions(userId: number, prevLuckyWheelId: number): Promise<LuckyWheelSessions[]|any> {
        const randomLuckyWheel = `
            SELECT 
                luckyWheels.id AS lucky_wheel_id 
            FROM 
                lucky_wheels luckyWheels
            WHERE 
                is_active=1 
            ORDER BY RAND() limit 1;
        `;

        let luckyWheelId = 0;
        const result       = await this.dbConn.query(randomLuckyWheel);

        if (result.length > 0) {
            const rowData = result[0];
            luckyWheelId  = rowData['lucky_wheel_id'];
            if (!luckyWheelId) {
                luckyWheelId = prevLuckyWheelId
            }
        }

        await this.dbConn.getRepository(LuckyWheelSessions)
        .save({
            user_id         : userId,
            lucky_wheel_id  : luckyWheelId,
            is_completed    : false
        });
    }

    public async luckyWheelSpin(user: Users): Promise<object | undefined | number> {
        if (user.lucky_wheel_spin_entries <= 0) return;
        
        const luckyWheelSession = await this.getLuckyWheelsSessionByUserId(user);
        const appConfig         = await this.appConfigService.getConfigByKey(APP_CONFIG_KEY.luckyWheel);
        let actPointBonus       = 0;
        if (appConfig) {
            actPointBonus       = Number(appConfig.config_value);
        }
            
        const luckyWheelSessionPrizes = await this.dbConn.getRepository(LuckyWheelSessionPrizes)
                                    .createQueryBuilder("luckyWheelSessionPrizes")
                                    .leftJoinAndSelect("luckyWheelSessionPrizes.luckyWheelPrizes", "luckyWheelPrizes")
                                    .where("luckyWheelSessionPrizes.deleted_at IS NULL")
                                    .andWhere("luckyWheelSessionPrizes.is_claimed IS TRUE")
                                    .andWhere("luckyWheelSessionPrizes.lucky_wheel_session_id = :luckyWheelSessionId", {luckyWheelSessionId: luckyWheelSession[0]?.id} )
                                    .getMany();
        
        const luckyWheelPrizes        = await this.dbConn.getRepository(LuckyWheelPrizes)
                                    .createQueryBuilder("luckyWheelPrizes")
                                    .leftJoinAndSelect("luckyWheelPrizes.luckyWheels", "luckyWheels")
                                    .leftJoinAndSelect("luckyWheelPrizes.gameInventory", "gameInventory")
                                    .where("luckyWheelPrizes.deleted_at IS NULL")
                                    .andWhere("luckyWheelPrizes.lucky_wheel_id = :luckyWheelId", {luckyWheelId : luckyWheelSession[0]?.lucky_wheel_id})
                                    .getMany();

        const sessionPrizeId    = luckyWheelSessionPrizes.map(l => l.lucky_wheel_prize_id);
        const prizeId           = luckyWheelPrizes.map(l => l.id);
        const lucky_wheel_id   = luckyWheelPrizes.map(l => l.lucky_wheel_id);
        console.log(lucky_wheel_id)

        const  availablePrizeToClaim = prizeId.filter((prize) => {
            return !sessionPrizeId.includes(prize)
        });

        const index = this.helperService.getRandomInt(availablePrizeToClaim.length);
        
        const prizeIdToBeClaimed  = availablePrizeToClaim[index];
        const claimedWheelPrize   = luckyWheelPrizes.filter((prize) => prize.id == prizeIdToBeClaimed)[0];

        
        if (!claimedWheelPrize) return;

        const claimedPrizes: Record<string, number> = {
            coin            : claimedWheelPrize.coin_prize,
            coupon          : claimedWheelPrize.coupon_prize,
            activity_point  : Number(claimedWheelPrize.activity_point_prize) + Number(actPointBonus)
        };
        const userDataToUpdate = {
            coins                   : user.coins + claimedPrizes.coin,
            coupons                 : user.coupons + claimedPrizes.coupon,
            activity_points         : user.activity_points + claimedPrizes.activity_point,
            lucky_wheel_spin_entries: user.lucky_wheel_spin_entries + (claimedWheelPrize.lucky_wheel_spin_entry_prize - 1)
        }
        const gameInventoriesWon: any[] = [];

        await this.dbConn.getRepository(LuckyWheelSessionPrizes)
        .save({
            lucky_wheel_session_id  : luckyWheelSession[0]?.id,
            lucky_wheel_prize_id    : prizeIdToBeClaimed,
            is_claimed              : true
        });

        if (luckyWheelSessionPrizes.length + 1 == luckyWheelPrizes.length ){
            await this.dbConn.getRepository(LuckyWheelSessions).update(luckyWheelSession[0].id, {
                is_completed: true
            });

            await this.addNewLuckyWheelSessions(user.id, luckyWheelSession[0]?.lucky_wheel_id)
        }

        await this.userService.update(user, userDataToUpdate);
        const updatedUser = await this.userService.getUser(user);

        if (claimedWheelPrize.game_inventory_id) {
            const gameInventory = await this.gameInventoryService.fetchInventoryById(claimedWheelPrize.game_inventory_id);
            if (gameInventory?.can_expired) {
                await this.gameInventoryService.storeNewUserInventory({
                    user_id     : user.id,
                    inventory_id: gameInventory.id,
                    quantity    : 1,
                    expired_at  : dayjs().add(BOOSTER_DURATION, 'minutes').format()
                });
            } else {
                const userInventory = await this.gameInventoryService.getUserInventoryByInventoryId(user.id, claimedWheelPrize.game_inventory_id);
                if (!userInventory) {
                    await this.gameInventoryService.storeNewUserInventory({
                        user_id     : user.id,
                        inventory_id: claimedWheelPrize.game_inventory_id,
                        quantity    : 1
                    });
                } else {
                    await this.gameInventoryService.addUserInventoryQuantity(user.id, userInventory, 1);
                }
            }
            gameInventoriesWon.push({
                id      : gameInventory?.id,
                code    : gameInventory?.code,
                name    : gameInventory?.name,
                value   : gameInventory?.value,
                quantity: 1,
                type    : 'CR'
            });
        }

        /** STORE TO TRANSACTION */
        const transactionPayload = {
            description : TRANSACTION_DESCRIPTIONS.WON_LUCKY_WHEEL,
            code        : TransactionAvailableCodeEnum.LUCKY_WHEEL_REWARD,
            extras      : JSON.stringify({data: {lucky_wheel_id: lucky_wheel_id.pop()?.toString(), game_inventories: gameInventoriesWon}}),
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
                        current_value   : currValue,
                        previous_value  : prevValue
                    }
                }
                return {} as TransactionDetailRequest
            }).filter((data) => Object.keys(data).length > 0)
        };

        await this.transactionService.storeUserTransaction(user, transactionPayload)

        // VIP USER
        await this.vipService.calculateLuckyWheelSpin(user.id);

        const result = {
            id                  : claimedWheelPrize.id,
            coupon_prize        : claimedPrizes.coupon,
            coin_prize          : claimedPrizes.coin,
            spin_entries        : claimedWheelPrize.lucky_wheel_spin_entry_prize,
            activity_point      : claimedWheelPrize.activity_point_prize,
            activity_point_bonus: actPointBonus, 
            game_inventory      : {
                id      : claimedWheelPrize.game_inventory_id,
                code    : claimedWheelPrize.gameInventory?.code ?? null,
                name    : claimedWheelPrize.gameInventory?.name ?? null
            }
        };

        return result;
    }


    public async resetUserSpinEntries (user: Users): Promise<boolean> {
        const currentEntries = user.lucky_wheel_spin_entries;
        if (currentEntries > 0) return false;
        await this.userService.update(user, {lucky_wheel_spin_entries: LUCKY_WHEEL_SPIN_ENTRIES});
        return true;
    }

    // Admin
    public async getLuckyWheelList(input: FilterLuckyWheels | null): Promise <[LuckyWheels[], number]>{
        const luckyWheels   = this.dbConn.getRepository(LuckyWheels)
                    .createQueryBuilder("luckyWheels")
                    .where('luckyWheels.deleted_at IS NULL');

        if(input != null){
            if(input.id){
                luckyWheels.andWhere("luckyWheels.id = :id", {id: input.id});
            }

            if(input.name){
                luckyWheels.andWhere("luckyWheels.name LIKE :name", {name: `%${input.name}%`});
            }

            if(input.sort){
                luckyWheels.orderBy("luckyWheels." + input.sort, "ASC");

                if(input.sortBy){
                    luckyWheels.orderBy("luckyWheels." + input.sort, input.sortBy);
                }
            }else{
                luckyWheels.orderBy("luckyWheels.updated_at", "DESC");
            }

            if(input.page){
                luckyWheels.skip((input.page - 1) * ROWS_PER_PAGE);
                luckyWheels.take(ROWS_PER_PAGE);
            }
        }

        const [result, total] = await luckyWheels.getManyAndCount();

        return [result, total];
    }

    public async getLuckyWheelDetail(input: FilterLuckyWheels): Promise<LuckyWheels | null> {
        const luckyWheel    = this.dbConn.getRepository(LuckyWheels)
                            .createQueryBuilder("luckyWheel")
                            .leftJoinAndSelect("luckyWheel.luckyWheelPrizes", "luckyWheelPrizes")
                            .leftJoinAndSelect("luckyWheelPrizes.gameInventory", "gameInventory")
                            .where("1=1");
        if (input.id) {
            luckyWheel.andWhere("luckyWheel.id = :id", { id: input.id });
        }

        if (input.name) {
            luckyWheel.andWhere("luckyWheel.name LIKE :name", { name: `%${input.name}%` });
        }

        return await luckyWheel.getOne();
    }

    public async getLuckyWheelByIdMapped(luckyWheelId: number): Promise<object | undefined> {
        const luckyWheel = await this.getLuckyWheelDetail({ id: luckyWheelId });

        if (luckyWheel == undefined) {
            return undefined;
        }

        const result = {
            id           : luckyWheel.id,
            name         : luckyWheel.name,  
            is_active    : luckyWheel.is_active,
            lucky_wheel_prizes : luckyWheel.luckyWheelPrizes?.map((l => {
                return {
                    id                       : l.id,
                    lucky_wheel_id           : l.lucky_wheel_id,
                    activity_point_prize     : l.activity_point_prize,
                    coin_prize               : l.coin_prize,
                    coupon_prize             : l.coupon_prize,
                    game_inventory           : {
                        id        : l.game_inventory_id,
                        name      : l.gameInventory?.name,
                    }
                }
            })),
        };

        return result;
    }

    public async getLuckyWheelById(id: number): Promise<LuckyWheels | undefined> {
        const luckyWheel = await this.dbConn.getRepository(LuckyWheels)
            .createQueryBuilder("luckyWheels")
            .where("luckyWheels.id = :id", { id: id })
            .andWhere('luckyWheels.deleted_at IS NULL')
            .getOne();

        if (luckyWheel == undefined) {
            return undefined;
        }

        return luckyWheel;
    }

    public async createLuckyWheel(input: CreateLuckyWheels): Promise <LuckyWheels | undefined | number>{
        const luckyWheel = await this.dbConn.getRepository(LuckyWheels).save({
            name        : input.name,
            is_active   : true
        });

        if(luckyWheel == undefined){
            return undefined;
        }

        return luckyWheel;
    }

    
    public async updateLuckyWheelById(id: number, input: UpdateLuckyWheels): Promise <boolean>{
        const payload = underscore.pick(input, LuckyWheelsUpdateable);
        
        if(Object.keys(payload).length !== 0){
            await this.dbConn.getRepository(LuckyWheels).update(id, payload);
        }

        return true;
    }

    public async deleteLuckyWheelById(id: number): Promise <boolean>{
        await this.dbConn.getRepository(LuckyWheels).update(id, {
            deleted_at: dayjs().format()
        });

        return true;
    }

    public async createLuckyWheelPrize(input: CreateLuckyWheelPrizes): Promise <LuckyWheelPrizes | undefined | number>{
        const luckyWheelPrizes = await this.dbConn.getRepository(LuckyWheelPrizes).save({
            lucky_wheel_id                : input.luckyWheel.id,
            coupon_prize                  : input.coupon_prize,
            coin_prize                    : input.coin_prize,
            game_inventory_id             : input.game_inventory_id,
            lucky_wheel_spin_entry_prize  : input.lucky_wheel_spin_entry_prize,
            activity_point_prize          : input.activity_point_prize,
        });
    
        if(luckyWheelPrizes == undefined){
            return undefined;
        }
    
        return luckyWheelPrizes;
    }

    public async getLuckyWheelPrizesById(id: number): Promise<LuckyWheelPrizes | undefined> {
        const luckyWheelPrizes = await this.dbConn.getRepository(LuckyWheelPrizes)
            .createQueryBuilder("luckyWheelPrizes")
            .where("luckyWheelPrizes.id = :id", { id: id })
            .andWhere('luckyWheelPrizes.deleted_at IS NULL')
            .getOne();

        if (luckyWheelPrizes == undefined) {
            return undefined;
        }

        return luckyWheelPrizes;
    }

    public async updateLuckyWheelPrizesById(id: number, input: UpdateLuckyWheelPrizes): Promise <boolean>{
        const payload = underscore.pick(input, LuckyWheelPrizesUpdateable);
        
        if(Object.keys(payload).length !== 0){
            await this.dbConn.getRepository(LuckyWheelPrizes).update(id, payload);
        }

        return true;
    }

    public async deleteLuckyWheelPrizesById(id: number): Promise <boolean>{
        await this.dbConn.getRepository(LuckyWheelPrizes).update(id, {
            deleted_at: dayjs().format()
        });

        return true;
    }

    public async getAllLuckyWheel(): Promise<LuckyWheels[]> {
        const [luckyWheel, count] = await this.dbConn.getRepository(LuckyWheels)
        .createQueryBuilder('luckyWheel')
        .leftJoinAndSelect('luckyWheel.luckyWheelSessions', 'luckyWheelSessions')
        .leftJoinAndSelect('luckyWheel.luckyWheelPrizes', 'luckyWheelPrizes')
        .getManyAndCount();

        return luckyWheel;
    }

    public async getTotalPrize(luckyWheelId : number) {
        const query = this.dbConn.getRepository(LuckyWheelSessionPrizes)
        .createQueryBuilder('luckyWheelSessionPrizes')
        .leftJoinAndSelect('luckyWheelSessionPrizes.luckyWheelPrizes', 'luckyWheelPrizes')
        .leftJoinAndSelect('luckyWheelSessionPrizes.luckyWheelSessions', 'luckyWheelSessions')
        .leftJoinAndSelect('luckyWheelPrizes.luckyWheels', 'luckyWheels')
        .leftJoinAndSelect('luckyWheelSessions.user', 'user')
        .select('SUM(luckyWheelPrizes.coupon_prize)', 'total_coupon')
        .addSelect('SUM(luckyWheelPrizes.lucky_wheel_spin_entry_prize)', 'total_lucky_wheel_spin_entry_prize')
        .addSelect('SUM(luckyWheelPrizes.activity_point_prize)', 'total_activity_point_prize')
        .addSelect('SUM(luckyWheelPrizes.game_inventory_id = 1)', 'total_booster_1_5_x')
        .addSelect('SUM(luckyWheelPrizes.game_inventory_id = 2)', 'total_extra_life_1_x')
        .addSelect('SUM(luckyWheelPrizes.game_inventory_id = 3)', 'total_booster_1_2_x')
        .addSelect('SUM(luckyWheelPrizes.game_inventory_id = 4)', 'total_booster_1_7_x')
        .addSelect([
            'luckyWheels.id as lucky_wheel_id',
            'user.username as username'
        ])
        .groupBy('luckyWheels.id')
        .where('luckyWheelSessions.lucky_wheel_id = :lucky_wheel_id', {lucky_wheel_id : luckyWheelId})

        const result = await query.getRawOne();
        return result;
    }

    public async getLuckyWheelAnalytic(){
        const luckyWheelList     = await this.getAllLuckyWheel();
        const data = [];
        for (const luckyWheel of luckyWheelList) {
            const total  = await this.getTotalPrize(luckyWheel.id)
            const response = {
                lucky_wheel_id                      : luckyWheel.id,
                lucky_wheel_name                    : luckyWheel.name,
                total_coupon                        : total.total_coupon,
                total_lucky_wheel_spin_entry_prize  : total.total_lucky_wheel_spin_entry_prize,
                total_activity_point_prize          : total.total_activity_point_prize,
                total_booster_1_5_x                 : total.total_booster_1_5_x,
                total_extra_life_1_x                : total.total_extra_life_1_x,
                total_booster_1_2_x                 : total.total_booster_1_2_x,
                total_booster_1_7_x                 : total.total_booster_1_7_x,
                created_at                          : luckyWheel.created_at,
                updated_at                          : luckyWheel.updated_at
            }
            data.push(response)
        }

        return data;
    }

    public async userLuckyWheelLog(input: FilterLuckyWheels | null, startDate: string, endDate: string): Promise <[LuckyWheelSessionPrizes[], number]> {
         const query = this.dbConn.getRepository(LuckyWheelSessionPrizes)
                    .createQueryBuilder('luckyWheelSessionPrizes')
                    .leftJoinAndSelect('luckyWheelSessionPrizes.luckyWheelPrizes', 'luckyWheelPrizes')
                    .leftJoinAndSelect('luckyWheelSessionPrizes.luckyWheelSessions', 'luckyWheelSessions')
                    .leftJoinAndSelect('luckyWheelPrizes.luckyWheels', 'luckyWheels')
                    .leftJoinAndSelect('luckyWheelPrizes.gameInventory', 'gameInventory')
                    .leftJoinAndSelect('luckyWheelSessions.user', 'user')
                    .select([
                        'luckyWheels.id as lucky_wheel_id',
                        'user.username as username',
                        'luckyWheelPrizes.coupon_prize as coupon',
                        'luckyWheelPrizes.coin_prize as coin',
                        'gameInventory.name as game_inventory',
                        'luckyWheelPrizes.activity_point_prize as activity_point',
                        'luckyWheelPrizes.lucky_wheel_spin_entry_prize as lucky_wheel_spin_entry',
                        'luckyWheelSessionPrizes.created_at as created_at'
                        
                    ])
                    .where('luckyWheelSessionPrizes.created_at BETWEEN :startDate and :endDate', {startDate, endDate})

                     if(input != null){
                        if(input.luckyWheelId){
                            query.andWhere("luckyWheels.id = :id", {id: input.luckyWheelId});
                        }
                        if(input.username){
                            query.andWhere("user.username = :username", {username: input.username});
                        }
                        if(input.page){
                            query.offset((input.page - 1) * ROWS_PER_PAGE_LUCKY_WHEEL)
                            .limit(ROWS_PER_PAGE_LUCKY_WHEEL)
                        }
                    }

        const raw =  await query.getRawMany();
        // console.log(raw);
        const [result, total] = [raw, raw.length];

        return [result, total];
    }


}
