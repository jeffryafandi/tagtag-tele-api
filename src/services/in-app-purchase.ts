import { Connection } from "typeorm";
import { InAppProducts } from "../entities/in-app-products";
import { InAppPurchaseSchema, InAppPurchases, InAppPurchaseSchemaGopay } from "../entities/in-app-purchases";
import { BaseService } from "./base";
import { GameInventoryService } from "./game_inventory";
import { UserService } from "./user";
import { TransactionService } from "./transaction";
import { Users } from "../entities/users";
import { IN_APP_PURCHASE_STATUS, TRANSACTION_DESCRIPTIONS, TRANSACTION_AVAILABLE_CODE, BOOSTER_DURATION, INVENTORIES_TYPE, QUEST_PRESET_VIP_ID, MISSION_PRESET_VIP_ID, MISSION_PRESET_REGULAR_ID } from '../config/constants';
import { PrizepoolService } from "./prizepool";
import { IncrementLogSource } from "../interfaces/requests/prizepool";
import dayjs from "dayjs";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import { FetchInAppProductsFilterRequest } from "../interfaces/requests/in-app-purchase";
import { UserGameInventories } from "../entities/user-game-inventories";
import { HelperService } from '../services/helper';
import * as fs from 'fs';
import * as path from 'path';
import { NotificationService } from '../services/fcm-notification';
import { NOTIF_CODE } from "../config/notif-constant";
import { verifyGoogleReceipt } from '@jeremybarbet/node-iap';
import { QuestService } from '../services/quest';
import { MissionService } from '../services/mission';
import { GameService } from "./game";
import { UserMissions } from "../entities/user-missions";
import { VipMemberships } from "../entities/vip-membership";
import { VipPrizepoolService } from "./vip-prizepool";

const helperService = new HelperService;

export class InAppPurchaseService extends BaseService {
    protected userService           : UserService;
    protected gameInventoryService  : GameInventoryService;
    protected transactionService    : TransactionService;
    protected prizepoolService      : PrizepoolService;
    protected notificationService   : NotificationService;
    protected questService          : QuestService;
    protected missionService        : MissionService;
    protected gameService           : GameService;
    protected vipPrizepoolService   : VipPrizepoolService;

    constructor(connection: Connection) {
        super(connection);
        this.userService            = new UserService(this.dbConn);
        this.transactionService     = new TransactionService(this.dbConn);
        this.gameInventoryService   = new GameInventoryService(this.dbConn);
        this.prizepoolService       = new PrizepoolService(this.dbConn);
        this.notificationService    = new NotificationService(this.dbConn);
        this.questService           = new QuestService(this.dbConn);
        this.missionService         = new MissionService(this.dbConn);
        this.gameService            = new GameService(this.dbConn); 
        this.vipPrizepoolService     = new VipPrizepoolService(this.dbConn);
    }

    public async getInAppProductByExtId(extId: string) {
        return await this.dbConn.getRepository(InAppProducts)
        .findOne({
            where: {
                ext_product_id      : extId
            },
            join: {
                alias               : 'inAppProduct',
                leftJoinAndSelect   : {
                    content         : 'inAppProduct.content'
                }
            }
        });
    }

    public async getPurchaseByToken(ext_token: string) {
        return await this.dbConn.getRepository(InAppPurchases)
        .findOne({where: { ext_token }});
    }

    public async savePurchase(schema: InAppPurchaseSchemaGopay){
        return await this.dbConn.getRepository(InAppPurchases).save(schema);
    }

    public async storeUserPurchase(user: Users, purchase: InAppPurchases) {
        const product = await this.getInAppProductByExtId(purchase.ext_product_id);
        if (product) {
            const content           = product.content;
            const boughtByUser: any = {
                coin    : content?.coin || 0,
                coupon  : content?.coupon || 0
            };
            const boughtInventories   = [];
            const boughtFreeAds       = [];
            
            await this.userService.update(user, {
                coins   : user.coins + boughtByUser.coin,
                coupons : user.coupons + boughtByUser.coupon
            });

            if(product.category == 'vip_member') {
                const activeVipMembership = await this.dbConn.getRepository(VipMemberships)
                    .createQueryBuilder('vipMembership')
                    .where('vipMembership.user_id = :userId', { userId: user.id })
                    .andWhere('vipMembership.expired_at > :currentTime', { currentTime: dayjs().format('YYYY-MM-DDTHH:mm:ss') })
                    .getOne();

                if (activeVipMembership) {
                    return false;
                }

                // insert vip membership
                // todo: tambahin endDate nya dari sisa hari sampai minggu
                const currentTime    = this.helperService.toDateTime(dayjs());
                const vipPrizepool   = await this.vipPrizepoolService.fetchLatestActivePrizepool();
                if (!vipPrizepool) return false;

                // jika cron calculate prizepool mingguan ga jalan, jadi masih baca prizepool minggu lalu return false
                if (this.helperService.toDateTime(dayjs(vipPrizepool.end_date)) < currentTime) {
                    return false
                }
                
                await this.userService.update(user, {
                    vip: true
                });

                const endDate       = dayjs(vipPrizepool.end_date).format('YYYY-MM-DDTHH:mm:ss')

                await this.dbConn.getRepository(VipMemberships).save({
                    user_id: user.id,
                    started_at: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
                    expired_at: endDate
                });

                await this.questService.updateUserQuestPreset(user.id, QUEST_PRESET_VIP_ID);
                await this.missionService.updateUserMissionPreset(user.id, MISSION_PRESET_VIP_ID);

                // reset and assign quest
                await this.questService.completeClaimedUserQuest();
                const gamesQuests = await this.gameService.getAllGames(QUEST_PRESET_VIP_ID);
                await this.questService.assignInitialQuest(user.id, gamesQuests);

                // reset and assign mission
                await this.dbConn.getRepository(UserMissions).update({user_id: user.id}, { is_completed : true, is_claimed : true });
                await this.missionService.assignInitialMission(user.id, MISSION_PRESET_VIP_ID);
            }

            if(content?.free_ads) {
                let newFreeAdsUntil;

                if (user.free_ads_until && dayjs(user.free_ads_until).isAfter(dayjs())) {
                    // Jika free_ads sudah ada dan belum kadaluarsa, tambahkan durasi
                    newFreeAdsUntil = dayjs(user.free_ads_until).add(content.free_ads, 'day').format();
                } else {
                    // Jika free_ads sudah kadaluarsa atau tidak memiliki tanggal, atur tanggal kadaluarsa baru
                    newFreeAdsUntil = dayjs().add(content.free_ads, 'day').format();
                }

                await this.userService.update(user, {
                    free_ads_until: newFreeAdsUntil,
                    free_ads_product_name: product?.name
                });

                boughtFreeAds.push({
                    in_app_product_id   : product?.id,
                    ext_product_id      : product?.ext_product_id,
                    name                : product?.name,
                    price               : product?.price
                });
            }

            const updatedUser = await this.userService.getUser(user);

            if (content?.game_inventory_id) {
                const gameInventory = await this.gameInventoryService.fetchInventoryById(content.game_inventory_id);

                let expired_at: string | undefined;

                if (gameInventory?.type == INVENTORIES_TYPE.IN_GAME) {
                    expired_at = dayjs().add(BOOSTER_DURATION, 'minutes').format()
                } else if (gameInventory?.type == INVENTORIES_TYPE.SHOP) {
                    expired_at = dayjs().add(content.game_inventory_duration || 0, 'hour').format()
                }

                if (gameInventory?.can_expired) {
                    if (gameInventory?.type == INVENTORIES_TYPE.SHOP) {
                        const userInventory = await this.gameInventoryService.getUserInventoryByInventoryId(user.id, content?.game_inventory_id);
                        if (userInventory) {
                            if (userInventory.expired_at && dayjs(userInventory.expired_at).isAfter(dayjs())) {
                                // Jika userInventory ada dan belum kedaluwarsa, tambahkan durasi
                                await this.dbConn.getRepository(UserGameInventories).update(userInventory.id, {
                                    expired_at: dayjs(userInventory.expired_at).add(expired_at ? dayjs(expired_at).diff(dayjs(), 'minute') : 0, 'minute').format(),
                                    quantity: content.game_inventory_quantity
                                });
                            } else {
                                // Jika userInventory ada tapi sudah kedaluwarsa atau tidak memiliki tanggal kedaluwarsa, atur tanggal kedaluwarsa baru
                                await this.dbConn.getRepository(UserGameInventories).update(userInventory.id, {
                                    expired_at: expired_at,
                                    quantity: content.game_inventory_quantity
                                });
                            }

                            boughtInventories.push({
                                id      : gameInventory?.id,
                                code    : gameInventory?.code,
                                name    : gameInventory?.name,
                                value   : gameInventory?.value,
                                quantity: content.game_inventory_quantity,
                                duration: content.game_inventory_duration,
                                type    : 'CR'
                            });
                        } else {
                            // Jika userInventory tidak ada, buat entri baru
                            await this.gameInventoryService.storeNewUserInventory({
                                user_id: user.id,
                                inventory_id: content.game_inventory_id,
                                quantity: 1,
                                expired_at: expired_at
                            });

                            boughtInventories.push({
                                id      : gameInventory?.id,
                                code    : gameInventory?.code,
                                name    : gameInventory?.name,
                                value   : gameInventory?.value,
                                quantity: 1,
                                duration: content.game_inventory_duration,
                                type    : 'CR'
                            });
                        }
                    } else if (gameInventory?.type == INVENTORIES_TYPE.IN_GAME) {
                        await this.gameInventoryService.storeNewUserInventory({
                            user_id     : user.id, 
                            inventory_id: content.game_inventory_id, 
                            quantity    : content.game_inventory_quantity, 
                            expired_at  : expired_at
                        });

                        boughtInventories.push({
                            id      : gameInventory?.id,
                            code    : gameInventory?.code,
                            name    : gameInventory?.name,
                            value   : gameInventory?.value,
                            quantity: content.game_inventory_quantity,
                            type    : 'CR'
                        });
                    }
                } else {
                    const userInventory = await this.gameInventoryService.getUserInventoryByInventoryId(user.id, content?.game_inventory_id);
                    if (!userInventory) {
                        await this.gameInventoryService.storeNewUserInventory({
                            user_id     : user.id, 
                            inventory_id: content.game_inventory_id, 
                            quantity    : content.game_inventory_quantity
                        });
                    } else {
                        await this.gameInventoryService.addUserInventoryQuantity(user.id, userInventory, content.game_inventory_quantity);
                    }

                    boughtInventories.push({
                        id      : gameInventory?.id,
                        code    : gameInventory?.code,
                        name    : gameInventory?.name,
                        value   : gameInventory?.value,
                        quantity: content.game_inventory_quantity,
                        type    : 'CR'
                    });
                }
            }
            
            const activePrizepool =  await this.prizepoolService.fetchLatestActivePrizepool();
            if (activePrizepool) {
                const data = {
                    prizepool_id: activePrizepool.id,
                    user_id: user.id,
                    source: IncrementLogSource.purchase,
                    source_id: purchase.id,
                    increment_value: purchase.price * activePrizepool.value_per_purchase
                }
                await this.prizepoolService.storePrizepoolIncrementLog(data)
            }

            /** STORE TO TRANSACTION */
            const transactionPayload = {
                description : TRANSACTION_DESCRIPTIONS.IN_APP_PURCHASE,
                code        : TransactionAvailableCodeEnum.USER_PURCHASE,
                extras      : boughtInventories.length > 0 ? JSON.stringify({data: {game_inventories: boughtInventories}}) 
                            : boughtFreeAds.length > 0 ? JSON.stringify({data: {free_ads: boughtFreeAds}}) 
                            : '',
                details     : Object.keys(boughtByUser).map((key): TransactionDetailRequest => {
                    if (boughtByUser[key] > 0) {
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
                            value           : boughtByUser[key],
                            current_value   : currValue,
                            previous_value  : prevValue
                        }
                    }
                    return {} as TransactionDetailRequest
                }).filter((data) => Object.keys(data).length > 0)
            };

            await this.transactionService.storeUserTransaction(user, transactionPayload);
        }
    }

    public async verifyGoogleReceipt(productId: string, purchaseToken: string) {
        const loadServiceAccount = () => {
            const filePath = path.join(__dirname, '..', '..', 'tag-tag-680e3-21e8179796d1.json');
            const rawData = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(rawData);
        };
        
        const serviceAccount = loadServiceAccount();

        try {
            const { data } = await verifyGoogleReceipt(
                {
                  packageName: process.env.PACKAGE_NAME ?? '',
                  token: purchaseToken,
                  productId: productId,
                  acknowledge: true,
                  fetchResource: true
                },
                {
                  clientEmail: serviceAccount.client_email,
                  privateKey: serviceAccount.private_key,
                },
            );

            console.log(data);
            
            if(!data?.orderId){
                return [false, null];
            }

            return [true, data.orderId];
        } catch (error) {
            console.error(error);
            return [false, null];
        }
        
    }

    public async initiateAppPurchase(user: Users, schema: InAppPurchaseSchema) {
        const product = await this.getInAppProductByExtId(schema.ext_product_id);
        const currentTimestamp = dayjs().valueOf()
        let statusCode = 200
        const status = 'FAILED'
        
        if (schema.ext_token) {
            const existingPurchase = await this.getPurchaseByToken(schema.ext_token);
            if (existingPurchase && existingPurchase.status === IN_APP_PURCHASE_STATUS.PURCHASE) {
                statusCode = 401
                return {
                    ...existingPurchase,
                    name: product?.name || '',
                    price: existingPurchase.price,
                    date: currentTimestamp,
                    status: status,
                    statusCode: statusCode
                };
            }
        }
        
        if (product) schema.price = product.price;

        if (schema.status == IN_APP_PURCHASE_STATUS.FAILED){
            schema.ext_token = status
        }

        schema.order_id = helperService.generateRandomNumber(10).toString()
        
        const stored = await this.dbConn.getRepository(InAppPurchases)
        .save(schema)

        if (schema.status == IN_APP_PURCHASE_STATUS.PURCHASE) {
            const verifyGoogleReceipt = await this.verifyGoogleReceipt(schema.ext_product_id, schema.ext_token)
            if(verifyGoogleReceipt[0]) {
                await this.storeUserPurchase(user, stored)
            } else {
                stored.status = status
                statusCode = 401
            }
        }

        const result = { 
            ...stored, 
            name: product?.name || '' ,
            price: product?.price,
            date: currentTimestamp,
            statusCode: 200
        };

        return result;
    }

    public async updateAppPurchase(purchase: InAppPurchases, schema: any): Promise<number> {
        const udpated = await this.dbConn.getRepository(InAppPurchases)
                        .createQueryBuilder()
                        .update(InAppPurchases)
                        .set(schema)
                        .where('id = :purchaseId', {purchaseId: purchase.id})
                        .execute();
        return udpated.affected || 0;
    }

    public async revertUserPurchase(user: Users, purchase: InAppPurchases) {
        const product = await this.getInAppProductByExtId(purchase.ext_product_id);
        if (product) {
            const content               = product.content;
            const revertedContent: any  = {
                coin    : content?.coin || 0,
                coupon  : content?.coupon || 0
            };

            const substractedInventories  = [];
            await this.userService.update(user, {
                coins   : user.coins - revertedContent?.coin,
                coupons : user.coupons - revertedContent?.coupon
            });
            
            const updatedUser = await this.userService.getUser(user);

            if (content?.game_inventory_id) {
                const userInventory = await this.gameInventoryService.getUserInventoryByInventoryId(user.id, content?.game_inventory_id);
                await this.gameInventoryService.substractUserGameInventory(user.id, userInventory?.gameInventory?.code || '', 1);
                substractedInventories.push({
                    id      : userInventory?.gameInventory?.id,
                    code    : userInventory?.gameInventory?.code,
                    name    : userInventory?.gameInventory?.name,
                    value   : userInventory?.gameInventory?.value,
                    quantity: 1,
                    type    : 'DB'
                })
            }

            const prizepoolIncrementLogs = await this.prizepoolService.findIncrementLogBySources(purchase.id, IncrementLogSource.purchase)
            if (prizepoolIncrementLogs){
                await this.prizepoolService.deletePrizepoolIncrementLogById(prizepoolIncrementLogs);
            }

            const transactionPayload = {
                description : TRANSACTION_DESCRIPTIONS.IN_APP_REFUND,
                code        : TransactionAvailableCodeEnum.USER_PURCHASE,
                extras      : (substractedInventories.length > 0) ? JSON.stringify({data: {game_inventories: substractedInventories}}) : '',
                details     : Object.keys(revertedContent).map((key): TransactionDetailRequest => {
                    if (revertedContent[key] > 0) {
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
                            type            : 'DB',
                            currency        : key as TransactionDetailCurrencyEnum,
                            value           : revertedContent[key],
                            current_value   : currValue,
                            previous_value  : prevValue
                        }
                    }
                    return {} as TransactionDetailRequest
                }).filter((data) => Object.keys(data).length > 0)
            };

            await this.transactionService.storeUserTransaction(user, transactionPayload);
        }
    }

    public async updatePurchaseByUser(user: Users, payload: {token: string, status: string}) {
        const currentPurchase = await this.getPurchaseByToken(payload.token);
        if (!currentPurchase) return;

        if (currentPurchase.status === IN_APP_PURCHASE_STATUS.PURCHASE) {
            if (payload.status === IN_APP_PURCHASE_STATUS.PURCHASE) return;
            if ([IN_APP_PURCHASE_STATUS.PENDING, IN_APP_PURCHASE_STATUS.UNKNOWN].includes(payload.status)) {
                await this.updateAppPurchase(currentPurchase, {status: payload.status})
                await this.revertUserPurchase(user, currentPurchase);
            }
        }

        if ([IN_APP_PURCHASE_STATUS.PENDING, IN_APP_PURCHASE_STATUS.UNKNOWN].includes(currentPurchase.status)) {
            if ([IN_APP_PURCHASE_STATUS.PENDING, IN_APP_PURCHASE_STATUS.UNKNOWN].includes(payload.status)) return;

            if (payload.status === IN_APP_PURCHASE_STATUS.PURCHASE) {
                await this.updateAppPurchase(currentPurchase, {status: IN_APP_PURCHASE_STATUS.PURCHASE})
                await this.storeUserPurchase(user, currentPurchase);
            }
        }

    }

    public async getUsersPurchaseByPeriod(userIds: number[], startDate: string, endDate: string): Promise<InAppPurchases[]> {
        return await this.dbConn.getRepository(InAppPurchases).createQueryBuilder()        
        .where("user_id IN(:...userIds)", { userIds })
        .andWhere("created_at between :startDate and :endDate", { startDate, endDate })
        .andWhere('status = "PURCHASED"')
        .getMany();
    }

    public async mapInAppProductsData(filter: FetchInAppProductsFilterRequest | undefined = undefined) {
        return (await this.fetchInAppProductsList(filter)).map((pd) => {
            return {
                id              : pd.id,
                ext_product_id  : pd.ext_product_id,
                name            : pd.name,
                description     : pd.description,
                price           : pd.price,
                category        : pd.category
            }
        });
    }

    public async fetchInAppProductsList(filter: FetchInAppProductsFilterRequest|undefined = undefined): Promise<InAppProducts[]> {
        const inAppProductRepository = this.dbConn.getRepository(InAppProducts)
        .createQueryBuilder()
        .where('is_shown = 1')
        .orderBy('price', 'ASC');
        
        if (filter?.group_name) {
            inAppProductRepository.andWhere('group_name = :groupName', { groupName: filter.group_name })
        }
        
        // inAppProductRepository.limit(250);
        return inAppProductRepository.getMany();
    }

    public async validateStoreUserPurchase(){
        const purchases = await this.dbConn.getRepository(InAppPurchases)
                    .createQueryBuilder('purchase')
                    .leftJoinAndSelect('purchase.user', 'user')
                    .where('purchase.type = :type', { type: "google" })
                    .andWhere('purchase.status = :status', { status: IN_APP_PURCHASE_STATUS.PENDING })
                    .andWhere('purchase.created_at >= NOW() - INTERVAL 3 DAY') // Menambahkan kondisi untuk created_at tidak lebih dari 3 hari
                    .getMany();

        if (purchases.length > 0) {
            for (const purchase of purchases) {
                if  (purchase.user) {
                    console.log(purchase.id)
                    const verifyGoogleReceipt = await this.verifyGoogleReceipt(purchase.ext_product_id, purchase.ext_token)
                    if(verifyGoogleReceipt[0]) {
                        const schema = { status: IN_APP_PURCHASE_STATUS.PURCHASE, iap_trx_id: verifyGoogleReceipt[1] };
                        await this.dbConn.getRepository(InAppPurchases)
                            .createQueryBuilder()
                            .update(InAppPurchases)
                            .set({
                                ...schema,
                                iap_trx_id: typeof schema.iap_trx_id === 'string' ? schema.iap_trx_id : undefined
                            })
                            .where('id = :id', { id: purchase.id })
                            // .where('status = :status', { status: IN_APP_PURCHASE_STATUS.PENDING })
                            // .where('user_id = :user_id', { user_id: purchase.user_id})
                            // .where('ext_product_id = :ext_product_id', { ext_product_id: purchase.ext_product_id})
                            // .where('ext_token = :ext_token', { ext_token: purchase.ext_token})
                            .execute();

                        await this.storeUserPurchase(purchase.user, purchase);

                        const product = await this.getInAppProductByExtId(purchase.ext_product_id);

                        const notificationParams: any     = {
                            product_name: product?.name || 'Unknown Product',
                            product_price: product?.price,
                            order_id: purchase.order_id
                        }
                        await this.notificationService.sendNotificationByCode(NOTIF_CODE.PURCHASE_SHOP_SUCCESS, notificationParams, [`${purchase.user_id}`]);
                    }
                }
            }

            return `${purchases.length} executed`;
        } else {
            return "No Pending Data"
        }
    }
}
