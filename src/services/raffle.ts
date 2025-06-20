import { Users } from "../entities/users";
import { Raffles } from "../entities/raffles";
import { BaseService } from "./base";
import { RafflePrizes } from "../entities/raffle-prizes";
import { RaffleTickets } from "../entities/raffle-tickets";
import { Connection, DeepPartial } from "typeorm";
import { TransactionService } from "./transaction";
import { TRANSACTION_DESCRIPTIONS, TRANSACTION_AVAILABLE_CODE, BOOSTER_DURATION, RAFFLE_TICKET_CHUNK_SIZE } from "../config/constants";
import { GameInventoryService } from "./game_inventory";
import { ExternalPrizeService } from "./ext-prize";
import { UserService } from "./user";
import { FilterRaffle, RaffleTicketSchema } from "../interfaces/requests/raffle";
import dayjs from "dayjs";
import { NOTIF_CODE, TRIGGERS } from "../config/notif-constant";
import { NotificationService } from "./fcm-notification";
import { QUEUE_TYPE } from "../config/queue-constant";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import { AppConfigService } from "./app-config";
import { ROWS_PER_PAGE } from "../config/constants";
import { RaffleParticipations } from "../entities/raffle-participations";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { SQSService } from "./aws/sqs";
import { VipService } from './vip';


export class RaffleService extends BaseService {
    protected transactionService    : TransactionService;
    protected gameInventoryService  : GameInventoryService;
    protected externalPrizeService  : ExternalPrizeService;
    protected userService           : UserService;
    protected notificationService   : NotificationService;
    protected sqsService            : SQSService;
    public appConfigService         : AppConfigService;
    protected vipService            : VipService;

    constructor(conn: Connection) {
        super(conn);
        this.gameInventoryService   = new GameInventoryService(conn);
        this.transactionService     = new TransactionService(conn);
        this.externalPrizeService   = new ExternalPrizeService(conn);
        this.userService            = new UserService(conn);
        this.notificationService    = new NotificationService(conn);
        this.sqsService             = new SQSService();
        this.appConfigService       = new AppConfigService(conn);
        this.vipService             = new VipService(conn);
    }

    public async listActiveRaffles(): Promise<Raffles[]> {
        const raffles   = this.dbConn.getRepository(Raffles)
                        .createQueryBuilder('raffles')
                        .where('raffles.is_active = 1');

        return await raffles.getMany();
    }

    public async fetchRaffleById(raffleId: number): Promise<Raffles|null> {
        const raffle = await this.dbConn.getRepository(Raffles).findOne({
            where: {
                id: raffleId
            },
            join: {
                alias: 'raffles',
                leftJoinAndSelect: {
                    rafflePrizes    : 'raffles.rafflePrizes',
                }
            }
        });

        return raffle
    }

    public mapRafflePrize(prize: RafflePrizes) {
        return {
            id          : Number(prize.id),
            name        : prize.name,
            image_url   : prize.image_url,
            description : prize.description,
            prize_order : prize.prize_order
        }
    }

    public async mapRaffleWinner(ticket: RaffleTickets, prize: RafflePrizes) {
        if (!ticket?.user_id) return;

        const userId    = ticket.user_id;
        const winner    = await this.userService.getUserById(userId);
        const mapPrize  = this.mapRafflePrize(prize);
        return {
            id      : userId,
            username: winner?.username,
            avatar  : winner?.avatar,
            prize   : mapPrize
        }
    }

    public async fetchUserRaffleParticipations(raffle: Raffles | number, userId: number): Promise<RaffleParticipations|null> {
        let raffleId  = raffle;

        if (isNaN(Number(raffle))) {
            raffle  = raffle as Raffles;
            raffleId= raffle.id;
        }

        const participation     = await this.dbConn.getRepository(RaffleParticipations)
                                .createQueryBuilder('raffleParticipations')
                                .where('raffle_id = :raffleId', {raffleId})
                                .andWhere('user_id = :userId', {userId})
                                .getOne();

        return participation;
    }

    public async updateRaffleParticipations(raffleId: number, userId: number, payload: QueryDeepPartialEntity<RaffleParticipations>) {
        await this.dbConn.getRepository(RaffleParticipations)
        .createQueryBuilder('raffleParticipations')
        .update()
        .set(payload)
        .where('raffle_id = :raffleId', {raffleId})
        .andWhere('user_id = :userId', {userId})
        .execute();
    }

    public async createRaffleParticipations(payload: DeepPartial<RaffleParticipations>) {
        await this.dbConn.getRepository(RaffleParticipations).save(payload);
    }

    public async fetchRandomRaffleParticipations(raffleId: number, userIds: number[] = []) {
        const query = this.dbConn.getRepository(RaffleParticipations).createQueryBuilder()
                    .where('raffle_id = :raffleId', { raffleId });

        if (userIds.length > 0) {
            query.andWhere('user_id NOT IN(:...userIds)', {userIds});
        }

        return await query.orderBy('RAND()')
        .getOne();
    }

    public async fetchTotalSubmittedTicket(raffle: Raffles | number, userId: number | undefined = undefined): Promise<number> {
        let raffleId  = raffle;

        if (isNaN(Number(raffle))) {
            raffle  = raffle as Raffles;
            raffleId= raffle.id;
        }
        const query = this.dbConn.getRepository(RaffleTickets)
                    .createQueryBuilder('raffleTickets')
                    .select("COUNT(raffleTickets.raffle_id)", "total_submitted")
                    .where('raffle_id = :raffleId', {raffleId});

        if (userId) {
            query.andWhere('user_id = :userId', {userId});
        }

        const data  = await query.getRawOne();
        return Number(data.total_submitted)
    }

    public async fetchWinningTicket(raffle: Raffles | number) {
        let raffleId  = raffle;

        if (isNaN(Number(raffle))) {
            raffle  = raffle as Raffles;
            raffleId= raffle.id;
        }
        const query = this.dbConn.getRepository(RaffleTickets)
                    .createQueryBuilder('raffleTickets')
                    .where('raffle_id = :raffleId', {raffleId})
                    .andWhere('raffle_prize_id IS NOT null');

        const data  = await query.getMany();
        return data;
    }

    public async mapRaffleData(raffle: Raffles, userId: number) {
        let authSubmitCoupons   = 0;
        if (userId) {
            const participation = await this.fetchUserRaffleParticipations(raffle, userId);
            if (participation) {
                authSubmitCoupons = participation.inserted_coupons;
            }
        }

        let mapData = {
            id                      : Number(raffle.id),
            name                    : raffle.name,
            image_url               : raffle.image_url,
            description             : raffle.description,
            target_pools            : raffle.target_pools,
            is_active               : raffle.is_active,
            is_completed            : raffle.is_completed,
            total_submitted_coupons : (raffle.inserted_coupons > raffle.target_pools) ? raffle.target_pools : raffle.inserted_coupons,
            auth_submitted_coupons  : authSubmitCoupons
        }

        if (raffle.rafflePrizes?.length > 0) {
            const prizes = raffle.rafflePrizes;
            prizes.sort((a, b) => a.prize_order - b.prize_order);

            const mapPrizes = prizes.map((prize) => this.mapRafflePrize(prize));
            mapData = {...mapData, prizes: mapPrizes} as any;
            
            if (raffle.is_completed) {
                const winningTickets    = await this.fetchWinningTicket(raffle);
                const mapWinners: any     = [];
                await Promise.all(prizes.map(async (prize) => {
                    const foundTicket   = winningTickets.filter((ticket) => ticket.raffle_prize_id == prize.id);
                    const mapWinner     = await this.mapRaffleWinner(foundTicket[0], prize);
                    if (mapWinner) {
                        mapWinners.push(mapWinner);
                    }
                }));
                mapData = {...mapData, winners: mapWinners } as any;
            }
        }

        return mapData;
    }

    public async fetchAllActiveRaffles(): Promise<Raffles[]> {
        return await this.dbConn.getRepository(Raffles)
        .createQueryBuilder('raffles')
        .leftJoinAndSelect('raffles.rafflePrizes', 'rafflePrizes')
        .where('raffles.is_completed = 0')
        .getMany();
    }

    public async mapUserRaffleData(user: Users|null): Promise<object> {
        const userId        = user?.id || 0;
        const raffles       = await this.listActiveRaffles();
        const mappedRaffles = await Promise.all(raffles.map(async (raffle) => {
            return await this.mapRaffleData(raffle, userId);
        }));
        return mappedRaffles; 
    }

    public async getRafflesDetailData(raffleId: number, user: Users|null): Promise<object> {
        const userId = user?.id || 0;
        const raffle = await this.fetchRaffleById(raffleId);
        if (!raffle) return {};

        const mapped = await this.mapRaffleData(raffle, userId);
        return mapped; 
        return {}
    }

    public async insertRaffleTicket(user: Users, raffleId: number) {
        await this.dbConn.getRepository(RaffleTickets).save({
            raffle_id: raffleId,
            user_id: user.id,
            ticket_no: `${this.helperService.generateRandomNumber(10)}`
        });
    }

    public async insertBulkRaffleTickets(data: Array<RaffleTicketSchema>) {
        await this.dbConn.getRepository(RaffleTickets)
        .createQueryBuilder()
        .insert()
        .into(RaffleTickets)
        .values(data)
        .execute();
    }

    public async updatePrize(rafflePrize: RafflePrizes, payload: any) {
        await this.dbConn.getRepository(RafflePrizes)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where('id = :id', {id: rafflePrize.id})
        .execute();
    }

    public async updateTicket(raffleTicket: RaffleTickets, payload: any) {
        await this.dbConn.getRepository(RaffleTickets)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where('id = :id', {id: raffleTicket.id})
        .execute();
    }
    
    public async updateRaffle(raffle: Raffles | number, payload: QueryDeepPartialEntity<Raffles>) {
        let raffleId  = raffle;

        if (isNaN(Number(raffle))) {
            raffle  = raffle as Raffles;
            raffleId= raffle.id;
        }

        await this.dbConn.getRepository(Raffles)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where('id = :id', {id: raffleId})
        .execute();
    }

    public async addUserRaffleParticipations(raffleId: number, userId: number, insertedCoupons: number) {
        const participation = await this.fetchUserRaffleParticipations(raffleId, userId);
        if (!participation) {
            await this.createRaffleParticipations({
                raffle_id       : raffleId, 
                user_id         : userId, 
                inserted_coupons: insertedCoupons
            });
        } else {
            await this.updateRaffleParticipations(raffleId, userId, { inserted_coupons: Number(participation.inserted_coupons + insertedCoupons) });
        }
    }

    public async fetchRaffleWinningTicket(raffleId: number): Promise<RaffleTickets[]> {
        return await this.dbConn.getRepository(RaffleTickets)
        .createQueryBuilder()
        .where('raffle_id = :raffleId', {raffleId})
        .andWhere('raffle_prize_id IS NOT NULL')
        .getMany();
    }

    public async fetchRandomTicket(raffleId: number, userIds: number[] = []) {
        const query = this.dbConn.getRepository(RaffleTickets)
        .createQueryBuilder('raffleTickets')
        .leftJoinAndSelect('raffleTickets.user', 'user')
        .where('raffle_id = :raffleId', {raffleId})
        .andWhere('raffle_prize_id is NULL');

        if (userIds.length > 0) {
            query.andWhere('user_id NOT IN(:...userIds)', {userIds});
        }

        return await query.orderBy('RAND()')
        .getOne();
    }

    public async fetchRandomTicketV3(raffleId: number, userIds: number[] = []): Promise<RaffleTickets|null> {
        console.log('[fetchRandomTicketV3] processing raffleId:', raffleId);
        const bannedUsers = await this.userService.findBannedUserIds();
        if (bannedUsers.length > 0) {
            bannedUsers.forEach((data) => {
                userIds.push(data.user_id);
            });
        }

        // fetch winners;
        const participator = await this.fetchRandomRaffleParticipations(raffleId, userIds);
        if (!participator) return null;

        const ticket    = await this.dbConn.getRepository(RaffleTickets)
                        .createQueryBuilder('raffleTickets')
                        .leftJoinAndSelect('raffleTickets.user', 'user')
                        .where('raffleTickets.user_id = :userId', { userId: participator.user_id})
                        .andWhere('raffleTickets.raffle_id = :raffleId', { raffleId })
                        .limit(1)
                        .getOne();
        return ticket;
    }

    public async fetchRandomTicketV2(raffleId: number, userIds: number[] = []) {
        console.log('[fetchRandomTicketV2] processing raffleId:', raffleId);

        const bannedUsers = await this.userService.findBannedUserIds();
        if (bannedUsers.length > 0) {
            bannedUsers.forEach((data) => {
                userIds.push(data.user_id);
            });
        }

        let userFilterQuery = '';
        if (userIds.length > 0) {
            userFilterQuery = 'AND raffleTickets.user_id NOT IN ('+userIds.join(',')+')';
        }

        const totalRandomTicketQuery = `
            SELECT 
                raffleTickets.id AS raffleTickets_id 
            FROM 
                raffle_tickets raffleTickets
            WHERE 
                raffle_id=`+raffleId+` 
                AND raffle_prize_id IS NULL
                `+userFilterQuery+`
            ORDER BY RAND() limit 1;
        `;

        console.log('[fetchRandomTicketV2] query:', totalRandomTicketQuery);

        let raffleTicketId = null;
        const result = await this.dbConn.query(totalRandomTicketQuery);
        if (result.length > 0) {
            const rowData = result[0];

            raffleTicketId = rowData['raffleTickets_id'];
        }

        console.log('[fetchRandomTicketV2] randomTicket:', raffleTicketId);

        return await this.dbConn.getRepository(RaffleTickets)
            .createQueryBuilder('raffleTickets')
            .leftJoinAndSelect('raffleTickets.user', 'user')
            .where('raffleTickets.id = :raffleTicketId', {raffleTicketId})
            .getOne();
    }

    public async assignPrizeToTicket(rafflePrize: RafflePrizes) {
        console.log('[assignPrizeToTicket] rafflePrize:', rafflePrize);

        const winners = await this.fetchRaffleWinningTicket(rafflePrize.raffle_id);
        console.log('[assignPrizeToTicket] winners:', winners);

        const wonByUserIds: number[] = [];
        if (winners.length > 0) {
            for (const winner of winners) {
                wonByUserIds.push(Number(winner.user_id));                
            }
        }
        console.log('[assignPrizeToTicket] wonByUserIds:', wonByUserIds);

        const ticket = await this.fetchRandomTicketV3(rafflePrize.raffle_id, wonByUserIds);
        if (!ticket || !ticket?.user) return;

        console.log('[assignPrizeToTicket] ticket:', ticket);
        await this.updateTicket(ticket, {raffle_prize_id: rafflePrize.id, is_used: true})
        await this.updatePrize(rafflePrize, {is_claimed: true})
        console.log('[assignPrizeToTicket] ticket and prize updated');

        const claimedPrizes: any = {
            coin            : rafflePrize.coin_prize,
            coupon          : rafflePrize.coupon_prize,
            activity_point  : rafflePrize.activity_point_prize
        }
        const gameInventoriesWon  = [];

        await this.userService.update(ticket.user, {
            coupons         : ticket.user.coupons + claimedPrizes.coupon,
            coins           : ticket.user.coins + claimedPrizes.coin,
            activity_points : ticket.user.activity_points + claimedPrizes.activity_point
        });

        console.log('[assignPrizeToTicket] this.userService.update processed');

        if (rafflePrize.ext_prize_id) {
            await this.externalPrizeService.assignExtPrizeToUser(ticket.user_id, rafflePrize.ext_prize_id);
            console.log('[assignPrizeToTicket] this.externalPrizeService.assignExtPrizeToUser processed');
        }

        if (rafflePrize.game_inventory_id) {
            const gameInventory = await this.gameInventoryService.fetchInventoryById(rafflePrize.game_inventory_id);
            if (gameInventory?.can_expired) {
                await this.gameInventoryService.storeNewUserInventory({
                    user_id     : ticket.user_id, 
                    inventory_id: rafflePrize.game_inventory_id, 
                    quantity    : 1, 
                    expired_at  : dayjs().add(BOOSTER_DURATION, 'minutes').format()
                });
            } else {
                const userInventory = await this.gameInventoryService.getUserInventoryByInventoryId(ticket.user_id, rafflePrize.game_inventory_id);
                if (!userInventory) {
                    await this.gameInventoryService.storeNewUserInventory({
                        user_id     : ticket.user_id, 
                        inventory_id: rafflePrize.game_inventory_id, 
                        quantity    : 1
                    });
                } else {
                    await this.gameInventoryService.addUserInventoryQuantity(ticket.user_id, userInventory, 1);
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

            console.log('[assignPrizeToTicket] gameInventoriesWon:', gameInventoriesWon);
        }

        /** STORE TO TRANSACTION */
        const updatedUser = await this.userService.getUser(ticket.user);
        const transactionPayload = {
            description : TRANSACTION_DESCRIPTIONS.WON_RAFFLE,
            code        : TransactionAvailableCodeEnum.RAFFLE_REWARD,
            extras      : (gameInventoriesWon.length > 0) ? JSON.stringify({data: {game_inventories: gameInventoriesWon}}) : '',
            details     : Object.keys(claimedPrizes).map((key): TransactionDetailRequest => {
                if (claimedPrizes[key] > 0) {
                    let prevValue   = 0;
                    let currValue   = 0;
                    switch (key) {
                        case TransactionDetailCurrencyEnum.COIN:
                            prevValue   = ticket?.user?.coins || 0;
                            currValue   = updatedUser?.coins || 0;
                            break;
                        case TransactionDetailCurrencyEnum.COUPON:
                            prevValue   = ticket?.user?.coupons || 0
                            currValue   = updatedUser?.coupons || 0;
                            break;
                        case TransactionDetailCurrencyEnum.ACTIVITY_POINT:
                            prevValue   = ticket?.user?.activity_points || 0
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

        await this.transactionService.storeUserTransaction(ticket.user, transactionPayload);
        console.log('[assignPrizeToTicket] this.transactionService.storeUserTransaction processed');
    }

    public async completeRaffle(raffle: Raffles): Promise<void> {
        console.log('[completeRaffle] processing raffle_id:', raffle.id);

        const availablePrizes = raffle.rafflePrizes.filter((prize) => !prize.is_claimed);
        console.log('[completeRaffle] availablePrizes:', availablePrizes);

        availablePrizes.sort((a, b) => a.prize_order - b.prize_order);
        for (const prize of availablePrizes) {
            await this.assignPrizeToTicket(prize);
        }

        await this.updateRaffle(raffle, {is_completed: true});
    }

    public async handleRaffleTicketQueue(tickets: RaffleTicketSchema[]) {
        const userId    = tickets[0].user_id;
        const user      = await this.userService.getUserById(userId);
        if (user) {
            await this.insertBulkRaffleTickets(tickets);
            const transactionPayload = {
                description : TRANSACTION_DESCRIPTIONS.SUBMIT_RAFFLE,
                code        : TransactionAvailableCodeEnum.RAFFLE_REWARD,
                extras      : '',
                details     : [{
                    type            : 'DB',
                    currency        : TransactionDetailCurrencyEnum.COUPON,
                    value           : tickets.length,
                    previous_value  : user.coupons + tickets.length,
                    current_value   : user.coupons
                }] as TransactionDetailRequest[]
            };
    
            await this.transactionService.storeUserTransaction(user, transactionPayload)

            // VIP USER
            await this.vipService.calculateSubmitRaffle(user.id);
        }
    }

    public async sendTicketsToQueue(tickets: RaffleTicketSchema[]) {
        const chunked: Array<RaffleTicketSchema[]> = [];
        for (let i = 0; i < tickets.length; i += RAFFLE_TICKET_CHUNK_SIZE) {
            const chunk = tickets.slice(i, i + RAFFLE_TICKET_CHUNK_SIZE);
            chunked.push(chunk);
        }

        let queueCount = 1;
        for (const chunk of chunked) {
            const message = {
                type: QUEUE_TYPE.INSERT_RAFFLE_TICKET,
                data: chunk
            }
            const queueUrl = process.env.SQS_RAFFLES_URL;
            if (queueUrl) {
                const queueName         = queueUrl.split('/')[queueUrl.split('/').length - 1];
                const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
                const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
                const queueResponse     = await this.sqsService.sendSQSMessage(queueName, accessKeyId, secretAccessKey, JSON.stringify(message), process.env.AWS_REGION_ENV);
                console.log(`SUCCESS SENDING raffleTicket QUEUE #${queueCount}:`, queueResponse);
                queueCount++;
            }
        }
    }

    public async userSubmitCouponToRaffle(raffleId: number, user: Users|null, insertedCoupons: number): Promise<boolean> {
        const userCoupons   = user?.coupons;
        const raffle        = await this.fetchRaffleById(raffleId);
        if (!user || !userCoupons || !raffle) return false;

        const mappedTickets: Array<RaffleTicketSchema> = [];
        for (let count = 1; count <= insertedCoupons; count++) {
            mappedTickets.push({
                raffle_id : raffleId,
                user_id   : user.id,
                ticket_no : this.helperService.generateUUIDCode()
            })
        }

        await this.updateRaffle(raffleId, { inserted_coupons: Number(raffle.inserted_coupons + insertedCoupons) });
        await this.addUserRaffleParticipations(raffleId, user.id, insertedCoupons);

        await this.sendTicketsToQueue(mappedTickets);
        await this.userService.update(user, {coupons: user.coupons - Number(insertedCoupons)});

        return false;
    }

    public async finishingRaffles() {
        const raffles = await this.fetchAllActiveRaffles();

        for (const raffle of raffles) {
            const totalSubmitted   = raffle.inserted_coupons;

            if (totalSubmitted >= raffle.target_pools) {
                await this.completeRaffle(raffle);
                console.log('[finishingRaffles] raffle completed:', raffle.id);
                return true;
            }

            const isAlmostFull = totalSubmitted >= (raffle.target_pools * TRIGGERS.RAFFLE_POOL_LIMIT);
            
            if (isAlmostFull) {
                try {
                    const notif = await this.notificationService.fetchNotifByCode(NOTIF_CODE.ALMOST_FULL_RAFFLE);
                    if (notif && dayjs(notif.published_at).format() < dayjs().format()) {
                        await this.notificationService.sendNotificationQueue(notif, {}, 'all');
                    }
                } catch (error) {
                    console.log("Cannot send notification!")
                }
            }
        }
    }

    public async userHistoryRaffleWinner(input: FilterRaffle | null): Promise <[Raffles[], number]> {
        const logs = this.dbConn.getRepository(Raffles)
                    .createQueryBuilder('raffles')
                    .leftJoinAndSelect('raffles.raffleTickets', 'raffleTickets')
                    .leftJoinAndSelect('raffles.rafflePrizes', 'rafflePrizes')
                    .leftJoinAndSelect('rafflePrizes.gameInventory', 'gameInventory')
                    .leftJoinAndSelect('rafflePrizes.extPrizes', 'extPrizes')
                    .leftJoinAndSelect('raffleTickets.user', 'user')
                    .select([
                        'raffles.id',
                        'raffles.name',
                        'raffleTickets.user_id',
                        'user.username as username',
                        'rafflePrizes.coupon_prize',
                        'rafflePrizes.coin_prize',
                        'gameInventory.id',
                        'gameInventory.name',
                        'extPrizes.id',
                        'rafflePrizes.activity_point_prize',
                        'rafflePrizes.prize_order',
                        'rafflePrizes.is_claimed',

                    ])
                    .where('raffles.deleted_at is NULL')
                    .andWhere('raffleTickets.raffle_prize_id is not NULL')
                    

         if(input != null){
            if(input.id){
                logs.andWhere('raffles.id = :id', {id: input.id})
            }
            if(input.page){
                logs.skip((input.page - 1) * ROWS_PER_PAGE);
                logs.take(ROWS_PER_PAGE);
            }
        }
      
        const result = await logs.getRawMany();

        return [result, result.length];

    }
}
