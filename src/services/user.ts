import { Connection, DeleteResult, InsertResult, UpdateResult, Brackets, getManager, createQueryBuilder, DeepPartial, SelectQueryBuilder } from 'typeorm';
import { UserUpdateable, Users } from "../entities/users";
import { 
    CreateUser, 
    CreateUserGoogleIdRequest, 
    FilterUser,
    CreatePrimaryAddress,
    AddAuthAffiliateRequest,
    AddAffiliateSocials,
    AddUserReferralPrizeRequest,
    AvailableAffiliateStatus,
    UserWithdrawRequest,
    UserWithdrawStatus,
    AvailableWithdrawCurrency,
    UserClaimPrize,
    UserClaimPrizeStatus,
    UpdateUser,
    UserWithdrawEWalletRequest,
    UserVerificationStatusEnum,
    FilterUserAnalytic,
    BanUnBanUsersRequest
} from "../interfaces/requests/users";
import bcrypt from 'bcrypt';
import { Games } from "../entities/games";
import { Affiliates } from '../entities/affiliates';
import { AffiliateSocials } from '../entities/affiliate-socials';
import { Transactions } from '../entities/transactions';
import { UserReferralPrizes } from '../entities/user_referral_prizes';
import { REFERRAL_COUPONS, LUCKY_WHEEL_SPIN_ENTRIES, INQUIRY_SENDERS, INQUIRY_PURPOSES, TRANSACTION_DESCRIPTIONS, AFFILIATES_BONUS_COIN, AFFILIATES_BONUS_COUPON } from '../config/constants';
import { TransactionService } from './transaction';
import { TRANSACTION_AVAILABLE_CODE, STAMINA_ENTRIES } from "../config/constants";
import { AffiliateUpgradeRequests } from '../entities/affiliate-upgrade-requests';
import { HelperService } from './helper';
import dayjs from 'dayjs';
import { GameInventoryService } from './game_inventory';
import { ActiveUserInventoryResponse } from '../interfaces/responses/auth';
import _ from 'underscore';
import { UserGameInventories } from '../entities/user-game-inventories';
import { BankService } from './bank';
import { DuitkuInquiryRequest, DuitkuProcessType, DuitkuTransferRequest } from '../interfaces/requests/duitku';
import { UserWithdraws } from '../entities/user-withdraws';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UserDevices } from '../entities/user-devices';
import { UserExtPrizes } from '../entities/user-ext-prizes';
import { AwdService } from './awd';
import { AwdCheckBillRequest, AwdPayBillRequest, AwdPrepaidRequest, AwdProcessType } from '../interfaces/requests/awd';
import { ExternalPrizeService } from './ext-prize';
import { OperatorService } from './operator';
import { UserVerifications } from '../entities/user-verifications';
import { StorageService } from './storage';
import underscore from 'underscore';
import { Operators } from '../entities/operators';
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from '../interfaces/requests/transaction';
import { AppConfigService } from './app-config';
import { NotificationService } from './fcm-notification';
import { NOTIF_CODE } from '../config/notif-constant';
import { EmailService } from './email';
import { TransactionDetails } from '../entities/transaction-details';
import { AffiliateService } from './affiliate';
import { UserPinService } from './user-pin';
import { ROWS_PER_PAGE } from "../config/constants";
import { UserBans } from '../entities/user-bans';
import { TelegramService } from './telegram';
import { GameService } from './game';
import { DuitkuService } from './duitku';
import { type } from 'os';
import { APP_CONFIG_KEY } from "../config/app-config-constant";


export class UserService {
    public dbConn: Connection;
    protected transactionService    : TransactionService;
    protected helperService         : HelperService;
    protected gameInventoryService  : GameInventoryService;
    protected bankService           : BankService;
    protected awdService            : AwdService;
    protected externalPrizeService  : ExternalPrizeService;
    protected operatorService       : OperatorService;
    protected storageService        : StorageService;
    protected appConfigService      : AppConfigService;
    protected emailService          : EmailService;
    protected affiliateService      : AffiliateService;
    public userPinService           : UserPinService;
    protected telegramService       : TelegramService;
    protected gameService           : GameService;
    protected duitkuService         : DuitkuService;

    constructor(connection: Connection){
        this.dbConn                 = connection;
        this.helperService          = new HelperService;
        this.emailService           = new EmailService;
        this.transactionService     = new TransactionService(connection);
        this.gameInventoryService   = new GameInventoryService(connection)
        this.bankService            = new BankService(connection);
        this.awdService             = new AwdService(connection);
        this.awdService             = new AwdService(connection);
        this.externalPrizeService   = new ExternalPrizeService(connection);
        this.operatorService        = new OperatorService(connection);
        this.storageService         = new StorageService(connection);
        this.appConfigService       = new AppConfigService(connection);
        this.affiliateService       = new AffiliateService(connection);
        this.userPinService         = new UserPinService(connection);
        this.telegramService        = new TelegramService();
        this.gameService            = new GameService(connection);
        this.duitkuService            = new DuitkuService(connection);
    }

    public async createUser(input: CreateUser, referred_user_id: number | undefined = undefined): Promise<Users | undefined>{
        let user = await this.dbConn.getRepository(Users).save({
            username            : input.username,
            name                : input.name,
            email               : input.email,
            phone_number        : input.phone_number,
            password            : bcrypt.hashSync(input.password, 10),
            confirm_otp_token   : input.confirm_otp_token,
            referred_user_id    : referred_user_id
        });

        return user;
    }

    public async createUserGoogleId(input: CreateUserGoogleIdRequest): Promise<Users>{
        let user = await this.dbConn.getRepository(Users).save({
            email                       : input.email,
            google_id                   : input.google_id,
            lucky_wheel_spin_entries    : LUCKY_WHEEL_SPIN_ENTRIES,
            username                    : input.email.split('@')[0],
            is_confirmed                : true
        });

        return user;
    }

    public async saveUserGoogleId(input: CreateUserGoogleIdRequest): Promise<number> {
        let user = await this.getUserByEmail(input.email);
        if (user === null) {
            return -1;
        }

        user.google_id  = input.google_id;
        user.username   = input.username || user.username;

        if (input.password) {
            user.password = bcrypt.hashSync(input.password, 10);
        }

        await this.dbConn.getRepository(Users).save(user);

        return 1;
    }

    public async getUserByApiToken(apiToken: string): Promise<Users | null>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.api_token = :apiToken", {apiToken: apiToken})
                    .andWhere('users.deleted_at IS NULL')
                    .leftJoinAndSelect('users.bans', 'bans', 'bans.user_id = users.id AND bans.is_expired = 0')
                    .getOne();

        if(user == null){
            return null;
        }

        return user;
    }

    public async getAffiliateUser(user: Users): Promise<Affiliates | null> {
        return await this.dbConn.getRepository(Affiliates)
        .createQueryBuilder('affiliates')
        .leftJoinAndSelect('affiliates.user', 'user')
        .leftJoinAndSelect('affiliates.affiliateBenefit', 'affiliateBenefit')
        .leftJoinAndSelect('affiliateBenefit.affiliateBenefitTierings', 'affiliateBenefitTierings')
        .where('affiliates.user_id = :user_id', {user_id: user.id })
        .getOne()
    }

    public async getAffiliateUpgradeRequestUserByAffiliateId(affiliateId: number): Promise<AffiliateUpgradeRequests | any> {
        return await this.dbConn.getRepository(AffiliateUpgradeRequests)
        .createQueryBuilder('affiliateUpgradeRequests')
        .where('affiliateUpgradeRequests.affiliate_id = :affiliateId', {affiliateId: affiliateId })
        .andWhere('affiliateUpgradeRequests.status = :status', {status: 'pending' })
        .getOne()
    }

    public async getUserByOtpToken(email: string, otpToken: string): Promise<Users | null>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.email = :email", {email: email})
                    .andWhere("users.otp_token = :otpToken", {otpToken: otpToken})
                    .andWhere('users.deleted_at IS NULL')
                    .getOne();

        if(user == null){
            return null;
        }

        return user;
    }

    public async getUserByEmailAndPassword(email: string, password: string): Promise<Users | null>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.email = :email", {email: email})
                    .andWhere('users.deleted_at IS NULL')
                    .getOne();

        if(user == null || bcrypt.compareSync(password, user.password) === false){
            return null;
        }

        return user;
    }

    public async getUserByEmail(email: string): Promise<Users | null>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.email = :email", {email: email})
                    .andWhere('users.deleted_at IS NULL')
                    .getOne();

        return user;
    }
    
    public async getUserAnalytic(input: FilterUserAnalytic){
        const users                 = await this.getAllUsers({created_at: input.end_date});
        const affiliateUsers        = await this.affiliateService.getAllAffiliateUsers(input.start_date, input.end_date);
        const registeredUsers       = await this.getRegisteredUsers(input.start_date, input.end_date);
        const activeUsers           = await this.getTotalActiveUsers(input.start_date, input.end_date);
        const totalCoins            = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date)
        const totalPrizepoolCoins   = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date, 'CR', [TransactionAvailableCodeEnum.PRIZEPOOL_REWARD])
        const totalRaffleCoins      = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date, 'CR', [TransactionAvailableCodeEnum.RAFFLE_REWARD])
        const totalRefferalCoins    = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date, 'CR', [TransactionAvailableCodeEnum.REFERRAL_CLAIM])
        const totalMysteriBoxCoins  = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date, 'CR', [TransactionAvailableCodeEnum.MYSTERY_BOX])
        const totalAdminUpdateCoins = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date, 'CR', [TransactionAvailableCodeEnum.ADMIN_USER_UPDATE])
        const totalPlayMissionCoins = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date, 'CR', [TransactionAvailableCodeEnum.PLAY_MISSIONS])
        const totalDailyQuestCoins  = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COIN, input.start_date, input.end_date, 'CR', [TransactionAvailableCodeEnum.PLAY_DAILY_QUEST])
        const totalPoins            = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.ACTIVITY_POINT, input.start_date, input.end_date)
        const totalCoupons          = await this.transactionService.getTotalCurrency(TransactionDetailCurrencyEnum.COUPON, input.start_date, input.end_date)
        const totalSpend            = await this.transactionService.getTotalCurrency([TransactionDetailCurrencyEnum.COIN, TransactionDetailCurrencyEnum.WITHDRAW_AMOUNT], input.start_date, input.end_date,'DB')
        
        let result = {
            registered_user         : Number(registeredUsers.registered_user),
            total_user              : users.length,
            active_users            : Number(activeUsers.active_user),
            total_coin              : totalCoins.total_value,
            total_prizepool_coin    : totalPrizepoolCoins.total_value,
            total_raffle_coin       : totalRaffleCoins.total_value,
            total_refferal_coin     : totalRefferalCoins.total_value,
            total_mysteri_box_coin  : totalMysteriBoxCoins.total_value,
            total_play_mission_coin : totalPlayMissionCoins.total_value,
            total_daily_quest_coin  : totalDailyQuestCoins.total_value,
            total_admin_update_coin : totalAdminUpdateCoins.total_value,
            total_poin              : totalPoins.total_value,
            total_coupon            : totalCoupons.total_value,
            total_affiliate_users   : affiliateUsers.length,
            total_redemption        : totalSpend.total_count,
            reward_redemption       : totalSpend.total_value
        }

        return result;
    }

    public async getTotalActiveUsers(startDate: string, endDate: string) {
        return await this.dbConn.getRepository(Transactions)
        .createQueryBuilder('transactions')
        .select('count(distinct(transactions.user_id))', 'active_user')
        .where('transactions.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
        .getRawOne()

    }

    public async getRegisteredUsers(startDate: string, endDate: string) {
        return await this.dbConn.getRepository(Users)
        .createQueryBuilder('users')
        .select('count(distinct(users.created_at))', 'registered_user')
        .where('users.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
        .getRawOne()

    }

    public async getAllUsers(filter: Record<string, any> = {}): Promise<Users[]>{
       let query   = this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.is_confirmed IS TRUE")
                    .andWhere("users.deleted_at IS NULL")

        if (Object.keys(filter).length > 0) {
            if (filter.created_at) {
                query.andWhere('created_at < :date', { date: filter.created_at })
            }
        }

        return await query.getMany();

    }

    public async getAllActiveUserIds() {
        return await this.dbConn.getRepository(Users)
        .createQueryBuilder('users')
        .select('users.id')
        .where("users.is_confirmed IS TRUE")
        .andWhere("users.deleted_at IS NULL")
        .getMany();
    }

    public async mappedAllUsers(input: FilterUser | null): Promise<[Users[], number]>{
        let users = this.dbConn.getRepository(Users)
                   .createQueryBuilder("users")
                   .where("users.is_confirmed IS TRUE")
                   .andWhere("users.deleted_at IS NULL")

       if(input != null){
            if(input.id){
                users.andWhere("users.id = :id", {id: input.id});
            }

            if(input.search){
                users.andWhere(new Brackets(qb => {
                    qb.where("users.id LIKE :search", {search: `%${input.search}%`})
                    .orWhere("users.username LIKE :search", {search: `%${input.search}%`})
                }));
            }

            if(input.sort){
                users.orderBy("users." + input.sort, "ASC");

                if(input.sortBy){
                    users.orderBy("users." + input.sort, input.sortBy);
                }
            }else{
                users.orderBy("users.updated_at", "DESC");
            }

            if(input.page){
                users.skip((input.page - 1) * ROWS_PER_PAGE);
                users.take(ROWS_PER_PAGE);
            }

        }

        let [result, total] = await users.getManyAndCount();

        return [result, total];
    }

    public async getUserById(userId: number): Promise<Users|null> {
        return await this.dbConn.getRepository(Users)
        .findOne({
            where: {
                id: userId
            }
        });
    }

    public async getUserByUsername(username: string): Promise<Users | null>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.username = :username", {username: username})
                    .andWhere('users.deleted_at IS NULL')
                    .leftJoinAndSelect('users.affiliate', 'affiliates')
                    .getOne();

        return user;
    }

    public async getUserByEmailAndForgotPasswordToken(email: string, token: string): Promise<Users | null>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.email = :email", {email: email})
                    .andWhere("users.reset_password_token = :token", {token: token})
                    .andWhere('users.deleted_at IS NULL')
                    .getOne();

        return user;
    }

    public async getUserByResetPasswordToken(token: string): Promise<Users | null>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.reset_password_token = :token", {token: token})
                    .andWhere('users.deleted_at IS NULL')
                    .getOne();

        return user;
    }

    public async update(currentUser: Users | number, schema: QueryDeepPartialEntity<Users>): Promise<number> {
        let userId          = currentUser;

        if (isNaN(Number(currentUser))) {
            currentUser     = currentUser as Users;
            userId          = currentUser.id;
        }

        const udpated   = await this.dbConn.getRepository(Users)
                        .createQueryBuilder()
                        .update(Users)
                        .set(schema)
                        .where('id = :userId', {userId: userId})
                        .execute();
        return udpated.affected || 0;
    }

    public async updatePassword(user: Users, old_password: string , new_password: string, new_password_confirmation: string): Promise<Users | number>{
        if(old_password != user.password){
            /** old password confirmation does not match */
            return -2
        }
        if(new_password != new_password_confirmation){
            /** password confirmation does not match */
            return -1
        }


        user.password              = bcrypt.hashSync(new_password, 10);
        user.reset_password_token  = '';

        await this.dbConn.getRepository(Users).save(user);

        return user;
    }

    public async isUserCompleted(user: Users): Promise<Boolean>{
        if(user.password && user.username){
            return true;
        }

        if(user.google_id){
            return true;
        }

        return false;
    }
    
    public mapUserActiveInventory(userInventories: UserGameInventories[]): ActiveUserInventoryResponse[] {
        const activeData: ActiveUserInventoryResponse[] = userInventories.map((userInventory) => {
            return {
                id          : userInventory.inventory_id,
                code        : userInventory.gameInventory?.code,
                value       : Number(userInventory.gameInventory?.value || 0),
                quantity    : userInventory.quantity,
                type        : userInventory.gameInventory?.type,
                expired_at  : dayjs(userInventory.expired_at).valueOf()
            }
        });

        return activeData;
    }

    public async getMappedAuth(user: Users): Promise<Object | undefined>{
        let users       = await this.dbConn.getRepository(Users)
                        .createQueryBuilder("users")
                        .leftJoinAndSelect("users.affiliate", "affiliate")
                        .leftJoinAndSelect("users.userPin", "userPin")
                        .leftJoinAndSelect("affiliate.affiliateBenefit", "affiliateBenefit")
                        .leftJoinAndSelect("affiliateBenefit.affiliateBenefitTierings", "affiliateBenefitTierings")
                        .where('users.deleted_at IS NULL')
                        .andWhere("affiliate.user_id = :userId", {userId: user.id})
                        .getOne();

        let games       = await this.gameService.getAllGames();
        let notPlayed   = [] as Number[];

        for (const game of games) {
            const userScore = await this.gameService.fetchGameScoreByGameIdAndUserId(user.id, game.id);
            if (!userScore) {
                notPlayed.push(game.id);
            }
        }

        const userExtraLifeQuantity = await this.gameInventoryService.getUserExtraLife(user?.id)
        const extraLifeQuantity = userExtraLifeQuantity ? userExtraLifeQuantity.quantity : 0;

        let result = {
            id                          : user?.id,
            avatar                      : user?.avatar,
            username                    : user?.username,
            default_username            : this.helperService.isDefaultUsername(user.username),
            email                       : user?.email,
            coins                       : user?.coins,
            coupons                     : user?.coupons,
            activity_points             : user?.activity_points,
            lucky_wheel_spin_entries    : user?.lucky_wheel_spin_entries,
            withdrawable_amount         : user?.withdrawable_amount,
            has_pin                     : users?.userPin?.user_id === user.id && users.userPin?.is_verified ? true : false,
            can_claim_mystery_box       : user.can_claim_mystery_box,
            gopay_number                : user.gopay_number?.replace(/^0+/, ''),
            stamina                     : user.stamina,
            max_stamina                 : STAMINA_ENTRIES,
            free_ads_until              : user.free_ads_until,
            free_ads_product_name       : user.free_ads_product_name,
            extra_life_quantity         : extraLifeQuantity,
            unplayed_games              : notPlayed,
            affiliate_benefit           : {
                id          : users?.affiliate?.affiliateBenefit?.id,
                name        : users?.affiliate?.affiliateBenefit?.name,
                percentage  : users?.affiliate?.affiliateBenefit?.affiliateBenefitTierings.length ? users?.affiliate?.affiliateBenefit?.affiliateBenefitTierings[0].value : 0,
            },
            vip                         : user?.vip,
            vip_points                  : user?.vip_points
        }

        const activeInventories = await this.gameInventoryService.getActiveUserInventories(user, dayjs().format());
        if (activeInventories.length > 0) {
            const activeData = this.mapUserActiveInventory(activeInventories);
            
            if (activeData.length > 0) {
                Object.assign(result, {active_inventories: activeData});
            }
        }

        if (user.user_verification_id) {
            const verification = await this.fetchUserVerificationById(user.user_verification_id);
            Object.assign(result, {
                user_verification: (!verification) ? null : {
                    id      : verification.id,
                    status  : verification.status
                }
            });
        }

        return result;
    }

    public async getAffiliateStatus(user: Users): Promise<Object | void > {
        let affiliate = await this.getAffiliateUser(user) 
        if (!affiliate) return;
        const latestRequest = await this.dbConn.getRepository(AffiliateUpgradeRequests)
        .findOne({
            join: {
                alias               : 'affiliateRequest',
                leftJoinAndSelect   : {
                    affiliateBenefit        : 'affiliateRequest.affiliateBenefit',
                    affiliateBenefitTierings: 'affiliateBenefit.affiliateBenefitTierings'
                }                
            },
            where: { affiliate_id: affiliate.id },
            order: { created_at: "DESC" }
        });

        let upgradeAvailableAt = dayjs().format('YYYY-MM-DDTHH:mm:ss');

        if (latestRequest) {
            switch (latestRequest.status) {
                case AvailableAffiliateStatus.rejected:
                    upgradeAvailableAt = this.helperService.addDays(latestRequest.updated_at, 1);
                    break;
                case AvailableAffiliateStatus.approved:
                    upgradeAvailableAt = this.helperService.addDays(latestRequest.updated_at, 30);
                    break;
                case AvailableAffiliateStatus.pending:
                    upgradeAvailableAt = this.helperService.addDays(latestRequest.created_at, 30);
                    break;
            }
        }

        let result = {
            status               : latestRequest?.status ?? AvailableAffiliateStatus.none,
            upgrade_available_at : upgradeAvailableAt,
            current_benefits     : {
                id         : affiliate.affiliateBenefit?.id,
                name       : affiliate.affiliateBenefit?.name,
                percentage : affiliate.affiliateBenefit?.affiliateBenefitTierings[0].value
            },
            previous_benefits   : {
                id         : latestRequest?.previous_benefit_id,
                name       : latestRequest?.affiliateBenefit.name,
                percentage : latestRequest?.affiliateBenefit?.affiliateBenefitTierings[0].value
            }

        }
        return result
    }

    public async getAuthMyTeam(user: Users): Promise<Object | undefined> {
        let myTeam = [];

        let users  = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where('users.deleted_at IS NULL')
                    .andWhere("users.referred_user_id = :refferedUserId", {refferedUserId: user.id})
                    .getMany();

        for (const user of users) {
            myTeam.push({
                id          : user.id,
                username    : user.username,
                created_at  : user.created_at,
            });
        }

        return myTeam;
    }

    public async getAuthTransactions(user: Users, code: TransactionAvailableCodeEnum | undefined = undefined): Promise<Object | undefined> {
        let mappedTransactions  = [];
        const transactionQuery  = this.dbConn.getRepository(Transactions)
                                .createQueryBuilder('transactions')
                                .leftJoinAndSelect('transactions.details', 'transaction_details')
                                .where('transactions.deleted_at IS NULL')
                                .andWhere("transactions.user_id = :userId", {userId: user.id});
        if (code) {
            transactionQuery.andWhere('transactions.code = :code', {code})
        }

        const transactions      = await  transactionQuery
                                .orderBy('transactions.created_at', 'DESC')
                                .limit(100)
                                .getMany();

        for (const transaction of transactions) {
            mappedTransactions.push({
                id          : transaction.id,
                description : transaction.description,
                code        : transaction.code,
                extras      : transaction.extras ? JSON.parse(transaction.extras) : null,
                details     : transaction.details.map((detail: any) => {
                    return {
                        value       : detail.value,
                        type        : detail.type,
                        currency    : detail.currency,
                    }
                }),
                created_at  : transaction.created_at,
            });
        }

        return mappedTransactions;
    }

    public async addAuthAffiliate(user: Users, input: AddAuthAffiliateRequest): Promise<Affiliates>{
        input = {...input, user_id: user.id, status: AvailableAffiliateStatus.approved}
        let affiliate = await this.dbConn.getRepository(Affiliates).save(input);

        return affiliate;
    }

    public async addAffiliateSocials(input: AddAffiliateSocials): Promise<AffiliateSocials | number | undefined>{
        let affiliateSocials = await this.dbConn.getRepository(AffiliateSocials).save({
            affiliate_id : input.affiliate.id,
            type         : input.type,
            link         : input.link,
        });

        if(affiliateSocials == undefined){
            return -3;
        }

        return affiliateSocials;
    
    }

    public async addUserReferralPrize(input: AddUserReferralPrizeRequest): Promise<UserReferralPrizes | number | undefined>{
        let refferralPrizes = await this.dbConn.getRepository(UserReferralPrizes).save({
            user_id          : input.user.id,
            referred_user_id : input.referred_user_id,
            coupons          : REFERRAL_COUPONS,
        });

        return refferralPrizes;
    }

    public async getUser(users: Users | number): Promise<Users | null>{
        let userId  = users;

        if (isNaN(Number(users))) {
            users   = users as Users;
            userId  = users.id;
        }

        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("users.id = :id", {id: userId})
                    .andWhere('users.deleted_at IS NULL')
                    .getOne();

        return user;
    }

    public async substractUserLuckyWheelSpinEntries (users: Users, qtyToReduce: number = 1) {
        return await this.update(users, {
            lucky_wheel_spin_entries: ( Number(users?.lucky_wheel_spin_entries) - qtyToReduce )
        });
    }

    public async storeUserWithdraw(schema: DeepPartial<UserWithdraws>): Promise<UserWithdraws> {
        return await this.dbConn.getRepository(UserWithdraws).save(schema);
    }

    public async substractUserWithdrawAmount (user: Users, payload: UserWithdrawRequest): Promise<boolean> {
        const userBank          = await this.bankService.fetchUserBankById(payload.user_bank_id);
        const notifService      = new NotificationService(this.dbConn);
        const appConfigs        = await this.appConfigService.getAllConfigs();
        const adminFee          = appConfigs.filter((config: any) => config.config_key === 'withdraw_admin_fees')[0];
        const availableAmount   = payload.currency == AvailableWithdrawCurrency.coin ? user.coins : user.withdrawable_amount;
        if (payload.amount > availableAmount || !userBank) return false;

        let userWithdrawStatus = UserWithdrawStatus.failed;

        const inquiryRequest: DuitkuInquiryRequest = {
            amount          : payload.amount - JSON.parse(`${adminFee.config_value}`).duitku.rtol_fee,
            real_withdrawn  : payload.amount,
            purpose         : INQUIRY_PURPOSES.USER_WITHDRAW,
            bank_account    : userBank.account_number,
            bank_code       : userBank.bank.bank_code,
            sender_name     : INQUIRY_SENDERS.ADMIN,
            user_id         : user.id
        };
        const duitkuWithdrawResponse    = await this.userDuitkuWithdraw(user, inquiryRequest, payload.currency);
        userWithdrawStatus              = duitkuWithdrawResponse.success ? UserWithdrawStatus.success : UserWithdrawStatus.failed;
        let notifCode                   = NOTIF_CODE.WITHDRAW_COIN_FAIL;
        let notificationParams: any     = {nominal: payload.amount - JSON.parse(`${adminFee.config_value}`).duitku.rtol_fee}

        if (userWithdrawStatus == UserWithdrawStatus.success) {
            notifCode = (payload.currency == AvailableWithdrawCurrency.coin) ? NOTIF_CODE.WITHDRAW_COIN_SUCCESS : NOTIF_CODE.WITHDRAW_REVENUE_SUCCESS;
        } else {
            notifCode = (payload.currency == AvailableWithdrawCurrency.coin) ? NOTIF_CODE.WITHDRAW_COIN_FAIL : NOTIF_CODE.WITHDRAW_REVENUE_FAIL;            
        }
        await notifService.sendNotificationByCode(notifCode, notificationParams, [`${user.id}`]);

        return userWithdrawStatus == UserWithdrawStatus.success; 
    }

    public async getAllUserAffiliates(): Promise<Users[]> {
        const users = await this.dbConn.getRepository(Users).createQueryBuilder('users')
        .leftJoinAndSelect('users.affiliate', 'affiliate')
        .leftJoinAndSelect('affiliate.affiliateUsers', 'affiliateUsers')
        .getMany();

        return users;
    }

    public async updateForAllUsers(schema: QueryDeepPartialEntity<Users>) {
        await this.dbConn.getRepository(Users)
        .createQueryBuilder()
        .update(Users)
        .set(schema)
        .where('deleted_at is null')
        .execute();
    }
    
    public async deleteUserDeviceByToken(token: string) {
        console.log("Deleting for token", token)
        return await this.dbConn.getRepository(UserDevices).delete({token});
    }

    public async fetchAllUserDeviceTokens(): Promise<UserDevices[]> {
        const userDevices   = await this.dbConn.getRepository(UserDevices)
                            .createQueryBuilder('user_devices')
                            .leftJoinAndSelect('user_devices.user', 'user')
                            .getMany();

        return userDevices;
    }

    public async fetchUserDevicesByUserIDS(ids: string[]): Promise<UserDevices[]> {
        const userIds       = ids.map((id) => Number(id));
        const userDevices   = await this.dbConn.getRepository(UserDevices)
                            .createQueryBuilder('user_devices')
                            .leftJoinAndSelect('user_devices.user', 'user')
                            .where("user_devices.user_id IN(:...ids)", { ids: userIds })
                            .getMany();

        return userDevices;
    }

    public async deleteUserDevicesByTokens(tokens: Array<string>) {
        await this.dbConn.getRepository(UserDevices)
        .createQueryBuilder()
        .delete()
        .from(UserDevices)
        .where('token IN(:...tokens)', {tokens})
        .execute();
    }

    public async fetchUserDevices(user: Users): Promise<UserDevices | null> {
        return await this.dbConn.getRepository(UserDevices)
        .createQueryBuilder()
        .where('user_id = :userId', {userId: user.id})
        .getOne();
    }

    
    public async storeUserDevice(schema: DeepPartial<UserDevices>): Promise<UserDevices> {
        return await this.dbConn.getRepository(UserDevices).save(schema);
    }

    public async updateUserDeviceByID(id: number, payload: QueryDeepPartialEntity<UserDevices>) {
        return await this.dbConn.getRepository(UserDevices)
        .createQueryBuilder()
        .update(UserDevices)
        .set(payload)
        .where('id = :id', {id})
        .execute();
    }
    
    public async updateOrReplaceDeviceToken(user: Users, deviceToken: string) {
        const device = await this.fetchUserDevices(user);
        if (!device) {
            await this.storeUserDevice({
                user_id : user.id,
                app_type: 'android',
                version : 'debug',
                token   : deviceToken
            });
        }
        // } else {
        //     // no need this because when notification is pushed, they are deleted this token when failed
        //     // const userDevice = listDevices[0];
        //     // await this.updateUserDeviceByID(userDevice.id, {token: deviceToken});
        // }
        return;
    }

    public async removeDeviceTokensByUserId(userId: number) {
        await this.dbConn.createQueryBuilder()
        .delete()
        .from(UserDevices)
        .where('user_id = :userId', { userId })
        .execute();
    }

    public async fetchUserExtPrizes(user: Users): Promise<Object | undefined> {
        let prizes = await this.dbConn.getRepository(UserExtPrizes)
                    .createQueryBuilder('userExtPrizes')
                    .leftJoinAndSelect('userExtPrizes.extPrizes', 'extPrizes')
                    .where('user_id = :userId', {userId: user.id})
                    .andWhere("is_claimed = :claimed", {claimed: false})
                    .getOne();
    
        let result = {
            id              : prizes?.id,
            name            : prizes?.extPrizes?.name,
            code            : prizes?.extPrizes?.code,
            description     : prizes?.extPrizes?.description,
            image_url       : prizes?.extPrizes?.image_url,
        }
    
        return result;
    }

    public async getUserExtPrizebyExtPrizeId(user: Users, userExtPrizeId: number): Promise<UserExtPrizes|null> {
        return await this.dbConn.getRepository(UserExtPrizes)
        .findOne({
            where: {
                user_id : user.id,
                id: userExtPrizeId,
                is_claimed: false
            },
            join: {
                alias               : 'userExtPrizes',
                leftJoinAndSelect   : {
                    extPrizes: 'userExtPrizes.extPrizes',
                    operators: 'extPrizes.operators'
                }
            }
        });
    }

    public async updateUserExtPrize(userExtPrizes: UserExtPrizes, payload: any) {
        await this.dbConn.getRepository(UserExtPrizes)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where('id = :id', {id: userExtPrizes.id})
        .execute();
    }

    public async authPrizeClai(user: Users, userExtPrizeId: number): Promise<void> {
        const userPrize = await this.getUserExtPrizebyExtPrizeId(user, userExtPrizeId);
        if (!userPrize) return;

        await this.updateUserExtPrize(userPrize, {is_claimed: true});
        return;
    }

    public async authPrizeClaim (user: Users, payload: UserClaimPrize, userExtPrizeId: number): Promise<boolean | undefined> {
        const userPrize = await this.getUserExtPrizebyExtPrizeId(user, userExtPrizeId);
        if (!userPrize) return;
        console.log(userPrize);

        let userClaimPrizeStatus = UserClaimPrizeStatus.failed;
        // PREPAID
        if(userPrize.extPrizes.operators?.type == 'prepaid'){
            const prepaidRequest: AwdPrepaidRequest = {
                product_id  : userPrize.extPrizes.code,
                msisdn      : payload.msisdn
            };
    
            const prepaidResponse = await this.awdService.prepaid(prepaidRequest);
    
            if (prepaidResponse.success) {
                userClaimPrizeStatus = UserClaimPrizeStatus.success
                await this.updateUserExtPrize(userPrize, {is_claimed: true});
            }
            
            await this.awdService.storeAwdLogs({
                logable_tab         : 'ext_prizes',
                logable_tab_id      : userPrize.ext_prize_id,
                type                : AwdProcessType.prepaid,
                json_response       : JSON.stringify(prepaidResponse.data)
            }, user);

            console.log("ext_prize", prepaidResponse.data)

        }

        
        if(userPrize.extPrizes.operators?.type == 'pay'){
            // Check Bill
            const checkRequest: AwdCheckBillRequest = {
                product_id  : userPrize.extPrizes.code,
                msisdn      : payload.msisdn
            };
            
            const checkResponse = await this.awdService.checkBill(checkRequest);
            console.log(checkResponse)
            
            // PAY
            if (checkResponse.success) {
                const payRequest: AwdPayBillRequest = {
                    product_id  : userPrize.extPrizes.code,
                    msisdn      : payload.msisdn,
                    amount      : checkResponse.data.detail.total_amount
                };
        
                const payResponse = await this.awdService.payBill(payRequest);
                if(payResponse.success){
                    userClaimPrizeStatus = UserClaimPrizeStatus.success
                    await this.updateUserExtPrize(userPrize, {is_claimed: true});
                    await this.awdService.storeAwdLogs({
                        logable_tab         : 'ext_prizes',
                        logable_tab_id      : userPrize.ext_prize_id,
                        type                : AwdProcessType.pay,
                        json_response       : JSON.stringify(payResponse.data)
                    }, user);
                }
            }
        }
        return userClaimPrizeStatus == UserClaimPrizeStatus.success; 
    }

    public async userDuitkuWithdraw(user: Users, payload: DuitkuInquiryRequest, currency: AvailableWithdrawCurrency): Promise<{success: boolean, data: any}> {
        const inquiryResponse   = await this.bankService.duitkuService.inquiry(payload);
        let success: boolean    = false;
        let transferResponse    = {} as {success: boolean, data: any};
        if (inquiryResponse.success) {
            const transferRequest: DuitkuTransferRequest = {
                disburse_id     : inquiryResponse.data.disburseId,
                amount          : inquiryResponse.data.amountTransfer,
                bank_account    : inquiryResponse.data.bankAccount,
                bank_code       : inquiryResponse.data.bankCode,
                purpose         : INQUIRY_PURPOSES.USER_WITHDRAW,
                account_name    : inquiryResponse.data.accountName,
                cust_ref_number : inquiryResponse.data.custRefNumber
            };

            transferResponse = await this.bankService.duitkuService.transfer(transferRequest);
            
            if (transferResponse.success) {
                if (currency == AvailableWithdrawCurrency.coin) {
                    console.log(currency, currency == AvailableWithdrawCurrency.coin)
                    await this.update(user, {coins: ( Number(user.coins) - (payload.real_withdrawn || payload.amount) )});
                } else {
                    await this.update(user, {withdrawable_amount: ( Number(user.withdrawable_amount) - (payload.real_withdrawn || payload.amount) )});
                }

                success = true;
            }
        }
        const duitkuUserWithdraw = await this.storeUserWithdraw({
            user_id         : user.id,
            withdraw_amount : payload.amount,
            status          : success ? UserWithdrawStatus.success : UserWithdrawStatus.failed
        });

        await this.bankService.duitkuService.storeDuitkuLogs({
            user_withdraw_id: duitkuUserWithdraw.id,
            type            : DuitkuProcessType.inquiry,
            json_response   : JSON.stringify(inquiryResponse.data)
        });

        if (transferResponse && Object.keys(transferResponse).length > 0) {
            await this.bankService.duitkuService.storeDuitkuLogs({
                user_withdraw_id: duitkuUserWithdraw.id,
                type            : DuitkuProcessType.transfer,
                json_response   : JSON.stringify(transferResponse.data)
            });
        }

        const details: TransactionDetailRequest[] = [];
        if (success) {
            const updatedUser   = await this.getUser(user); 
            let prevValue       = user.withdrawable_amount;
            let currValue       = updatedUser?.withdrawable_amount || 0;

            if (currency == AvailableWithdrawCurrency.coin) {
                prevValue = user.coins;
                currValue = updatedUser?.coins || 0;
            }

            details.push({
                type            : 'DB',
                currency        : (currency == AvailableWithdrawCurrency.coin) ? TransactionDetailCurrencyEnum.COIN : TransactionDetailCurrencyEnum.WITHDRAW_AMOUNT,
                value           : Number(payload.real_withdrawn || payload.amount),
                previous_value  : prevValue,
                current_value   : currValue
            });
        }
        await this.transactionService.storeUserTransaction(user, {
            description : TRANSACTION_DESCRIPTIONS.USER_WITHDRAW,
            code        : TransactionAvailableCodeEnum.USER_WITHDRAW,
            extras      : JSON.stringify({data: {
                user_withdraws: {
                    status  : success, 
                    amount  : (payload.real_withdrawn || payload.amount), 
                    currency: (currency == AvailableWithdrawCurrency.coin) ? TransactionDetailCurrencyEnum.COIN : TransactionDetailCurrencyEnum.WITHDRAW_AMOUNT
                }
            }}),
            details     : details
        });

        return {success, data: {inquiryResponse, transferResponse}}
    }

    public async userAwdWithdraw(user: Users, payload: AwdPrepaidRequest, operator: Operators, currency: AvailableWithdrawCurrency): Promise<{success: boolean, data: any}> {
        const prepaidResponse   = await this.awdService.prepaid(payload);
        let success: boolean    = false;
        if (prepaidResponse.success) {
            if (currency == AvailableWithdrawCurrency.coin) {
                await this.update(user, {coins: ( Number(user.coins) - operator.price )});
            } else {
                await this.update(user, {withdrawable_amount: ( Number(user.withdrawable_amount) - operator.price )});
            }

            success = true;
        }
        const details: TransactionDetailRequest[] = [];
        if (success) {
            const updatedUser   = await this.getUser(user); 
            let prevValue       = user.withdrawable_amount;
            let currValue       = updatedUser?.withdrawable_amount || 0;
            if (currency == AvailableWithdrawCurrency.coin) {
                prevValue = user.coins;
                currValue = updatedUser?.coins || 0;
            }

            details.push({
                type            : 'DB',
                currency        : (currency == AvailableWithdrawCurrency.coin) ? TransactionDetailCurrencyEnum.COIN : TransactionDetailCurrencyEnum.WITHDRAW_AMOUNT,
                value           : operator.price,
                previous_value  : prevValue,
                current_value   : currValue
            });
        }
        await this.transactionService.storeUserTransaction(user, {
            description : TRANSACTION_DESCRIPTIONS.USER_WITHDRAW,
            code        : TransactionAvailableCodeEnum.USER_WITHDRAW,
            extras      : JSON.stringify({data: {user_withdraws: {status: success, amount: operator.price, currency: (currency == AvailableWithdrawCurrency.coin) ? TransactionDetailCurrencyEnum.COIN : TransactionDetailCurrencyEnum.WITHDRAW_AMOUNT}}}),
            details     : details
        });

        return {success, data: {prepaidResponse}};
    }

    public async userWithdrawToEWallet(user: Users, payload: UserWithdrawEWalletRequest): Promise<boolean> {
        let userWithdrawStatus  = UserWithdrawStatus.failed;
        const operator          = await this.operatorService.fetchOperatorById(payload.operator_id);
        const availableAmount   = payload.currency == AvailableWithdrawCurrency.coin ? user.coins : user.withdrawable_amount;
        const activeVendor      = process.env.APP_OPERATOR_VENDOR || 'duitku';
        let userReceive         = 0;
        if (!operator || operator.price > availableAmount || operator.vendor !== activeVendor) return false;
        
        // add 0
        if (payload.account_number.indexOf('0') == -1) {
            payload.account_number = `0${payload.account_number}`
        }

        const notifService      = new NotificationService(this.dbConn);
        switch (activeVendor) {
            case 'awd':
                const prepaidRequest: AwdPrepaidRequest = {
                    product_id  : operator.code,
                    msisdn      : payload.account_number
                };

                const awdWithdrawResponse   = await this.userAwdWithdraw(user, prepaidRequest, operator, payload.currency);
                const awdUserWithdraw       = await this.storeUserWithdraw({
                    user_id         : user.id,
                    withdraw_amount : operator.price,
                    status          : awdWithdrawResponse.success ? UserWithdrawStatus.success : UserWithdrawStatus.failed
                });

                await this.awdService.storeAwdLogs({
                    logable_tab         : 'user_withdraws',
                    logable_tab_id      : awdUserWithdraw.id,
                    type                : AwdProcessType.prepaid,
                    json_response       : JSON.stringify(awdWithdrawResponse.data?.prepaidResponse?.data)
                }, user);
                userReceive         = operator.denom;
                userWithdrawStatus  = awdWithdrawResponse.success ? UserWithdrawStatus.success : UserWithdrawStatus.failed;
                break;

            default: // duitku
                const appConfigs    = await this.appConfigService.getAllConfigs();
                const adminFee      = appConfigs.filter((config: any) => config.config_key === 'withdraw_admin_fees')[0];
                const inquiryRequest: DuitkuInquiryRequest = {
                    amount          : operator.price - JSON.parse(`${adminFee.config_value}`).duitku.e_wallet_fee,
                    real_withdrawn  : operator.price,
                    purpose         : INQUIRY_PURPOSES.USER_WITHDRAW,
                    bank_account    : payload.account_number,
                    bank_code       : operator.code,
                    sender_name     : INQUIRY_SENDERS.ADMIN,
                    user_id         : user.id
                };
                const duitkuWithdrawResponse    = await this.userDuitkuWithdraw(user, inquiryRequest, payload.currency);
                userWithdrawStatus              = duitkuWithdrawResponse.success ? UserWithdrawStatus.success : UserWithdrawStatus.failed;
                userReceive                     = operator.price - JSON.parse(`${adminFee.config_value}`).duitku.e_wallet_fee;
                break;
        }
        let notifCode               = NOTIF_CODE.WITHDRAW_COIN_FAIL;
        let notificationParams: any = {nominal: userReceive}

        if (userWithdrawStatus == UserWithdrawStatus.success) {
            notifCode = (payload.currency == AvailableWithdrawCurrency.coin) ? NOTIF_CODE.WITHDRAW_COIN_SUCCESS : NOTIF_CODE.WITHDRAW_REVENUE_SUCCESS;
        } else {
            notifCode = (payload.currency == AvailableWithdrawCurrency.coin) ? NOTIF_CODE.WITHDRAW_COIN_FAIL : NOTIF_CODE.WITHDRAW_REVENUE_FAIL;            
        }
        await notifService.sendNotificationByCode(notifCode, notificationParams, [`${user.id}`]);
        return userWithdrawStatus == UserWithdrawStatus.success;
    }

    public async fetchUserVerificationById(id: number): Promise<UserVerifications|null> {
        return await this.dbConn.getRepository(UserVerifications)
        .findOne({
            where: {id},
            join: {
                alias: 'userVerifications',
                leftJoinAndSelect: {
                    user: 'userVerifications.user'
                }
            }
        
        });
    }

    public async storeUserVerifications(user: Users, data: {image: string}): Promise<boolean> {
        if (user.user_verification_id) {
            const verification = await this.fetchUserVerificationById(user.user_verification_id);
            if (verification?.status != UserVerificationStatusEnum.REJECTED) {
                return false;
            }
        }

        try {
            const imageUrl  = await this.storageService.upload(`user_verifications_${user.id}`, data.image);
            const verif     = await this.dbConn.getRepository(UserVerifications).save({
                user_id     : user.id,
                image_url   : imageUrl.file_url,
                status      : UserVerificationStatusEnum.PENDING
            });
            await this.update(user, {user_verification_id: verif.id});
            await this.emailService.sendvVerificationKTPPending(user);
            await this.telegramService.sendPendingKYCInfo(user, verif);
            return true;
        } catch (error) {
            throw Error('Cannot saving image to storage');
        }
    }

    public async updateUserVerification(data: {verification_id: number, status: string}): Promise<boolean> {
        const verification  = await this.fetchUserVerificationById(data.verification_id);
        if (!verification) throw Error('No verification found!');

        const updated   = await this.dbConn.getRepository(UserVerifications).update(verification.id, {status: data.status});
        const isUpdated = (updated.affected) ? updated.affected > 0 : false;
        
        if (isUpdated) {
            if(data.status == UserVerificationStatusEnum.REJECTED){
                await this.emailService.sendvVerificationKTPRejected(verification.user);   
            }
            if(data.status == UserVerificationStatusEnum.VERIFIED){
                await this.emailService.sendvVerificationKTPSuccess(verification.user);   
            }
            await this.update(verification.user_id, {user_verification_id: verification.id});
        }

        return isUpdated;
    }

    public async updateUserById(data : {user: Users, userId: number, input: UpdateUser}): Promise<Boolean>{
        const updateSchema = {
            coins           : data.user.coins + (data.input.add_coins ?? 0),
            coupons         : data.user.coupons + (data.input.add_coupons ?? 0),
            activity_points : data.user.activity_points + (data.input.add_activity_point ?? 0)
        }
        await this.update(data.user, updateSchema)

        const updatedUser   = await this.getUser(data.user);

        if (data.input.add_coins) {
            const transactionPayload = {
                description : 'User updated by Admin',
                code        : TransactionAvailableCodeEnum.ADMIN_USER_UPDATE,
                extras      : '',
                details     : [{
                    type            : 'CR',
                    currency        : TransactionDetailCurrencyEnum.COIN,
                    value           : data.input.add_coins,
                    previous_value  : data.user.coins,
                    current_value   : updatedUser?.coins || 0
                }] as TransactionDetailRequest[]
            };
    
            await this.transactionService.storeUserTransaction(data.user, transactionPayload);
        }
        if (data.input.add_coupons) {
            const transactionPayload = {
                description : 'User updated by Admin',
                code        : TransactionAvailableCodeEnum.ADMIN_USER_UPDATE,
                extras      : '',
                details     : [{
                    type            : 'CR',
                    currency        : TransactionDetailCurrencyEnum.COUPON,
                    value           : data.input.add_coupons,
                    previous_value  : data.user.coupons,
                    current_value   : updatedUser?.coupons || 0
                }] as TransactionDetailRequest[]
            };
    
            await this.transactionService.storeUserTransaction(data.user, transactionPayload);
        }
        if (data.input.add_activity_point) {
            const transactionPayload = {
                description : 'User updated by Admin',
                code        : TransactionAvailableCodeEnum.ADMIN_USER_UPDATE,
                extras      : '',
                details     : [{
                    type    : 'CR',
                    currency: TransactionDetailCurrencyEnum.ACTIVITY_POINT,
                    value   : data.input.add_activity_point,
                    previous_value  : data.user.activity_points,
                    current_value   : updatedUser?.activity_points || 0
                }] as TransactionDetailRequest[]
            };
    
            await this.transactionService.storeUserTransaction(data.user, transactionPayload);
        }

        return true;
    }

    public async getAllUsersExceptIDs(userIds: Array<number>, filter: {username?: string} | undefined = undefined): Promise<Array<Users>> {
        const query = this.dbConn.getRepository(Users)
        .createQueryBuilder()
        .where('id NOT IN(:...userIds)', { userIds })

        if (filter?.username) {
            query.andWhere('username LIKE :username', {username: `${filter.username}%`})
        }

        return await query.limit(100).getMany();
    }

    public async giveAffiliateBonusToUser(user: Users) {
        await this.update(user, {
            coins   : AFFILIATES_BONUS_COIN,
            coupons : AFFILIATES_BONUS_COUPON
        });
        const updatedUser = await this.getUser(user);
        await this.transactionService.storeUserTransaction(user, {
            description : TRANSACTION_DESCRIPTIONS.USER_REGISTER,
            code        : TransactionAvailableCodeEnum.USER_REGISTER,
            extras      : '',
            details     : [
                {
                    type            : 'CR',
                    value           : AFFILIATES_BONUS_COIN,
                    currency        : TransactionDetailCurrencyEnum.COIN,
                    previous_value  : user.coins,
                    current_value   : updatedUser?.coins || 0
                },
                {
                    type            : 'CR',
                    value           : AFFILIATES_BONUS_COUPON,
                    currency        : TransactionDetailCurrencyEnum.COUPON,
                    previous_value  : user.coupons,
                    current_value   : updatedUser?.coupons || 0
                }
            ]
        })
    }

    public async banUserByIds(payload: BanUnBanUsersRequest) {
        const bulkSchema: QueryDeepPartialEntity<UserBans>[] = payload.user_ids.map((id) => ({
            user_id     : id,
            ban_reason      : payload.reason || '',
            expired_in  : payload.expired_in || 0,
            is_expired  : false
        }));

        if (bulkSchema.length > 0) {
            await this.dbConn.getRepository(UserBans)
            .createQueryBuilder()
            .insert()
            .into(UserBans)
            .values(bulkSchema)
            .execute();
        }

    }

    public async unBanUserByIds(payload: BanUnBanUsersRequest) {
        if (payload.user_ids.length) {
            await this.dbConn.getRepository(UserBans)
            .createQueryBuilder()
            .update()
            .set({is_expired: true})
            .where('user_id IN(:...userIds)', { userIds: payload.user_ids })
            .andWhere('is_expired = 0')
            .execute();
        }
    }

    public async updateBan(userBanId: number, schema: QueryDeepPartialEntity<UserBans>) {
        await this.dbConn.getRepository(UserBans)
        .createQueryBuilder()
        .update()
        .set(schema)
        .where('id = :userBanId', {userBanId})
        .execute();
    }

    public async fetchBansByUserId(userId: number): Promise<UserBans[]> {
        return await this.dbConn.getRepository(UserBans)
        .createQueryBuilder()
        .where('is_expired = 0')
        .andWhere('user_id = :userId', {userId})
        .getMany();
    }

    public async findUserBans(filter: { canExpired: boolean } = { canExpired: false }): Promise<UserBans[]> {
        const query = this.dbConn.getRepository(UserBans)
        .createQueryBuilder()
        .where('is_expired = 0');
        if (filter.canExpired) {
            query.andWhere('expired_in > 0')
        }
        return await query.getMany();
    }

    public async findBannedUserIds() {
        return await this.dbConn.getRepository(UserBans)
        .createQueryBuilder()
        .select('user_id')
        .where('is_expired = 0')
        .getRawMany();
    }

    public async userWithdrawDetail(startDate: string, endDate: string) {
        let mapped = [];
        const duitkuLogs = await this.duitkuService.getUsersDuitkuLogs(startDate, endDate);
            for (const log of duitkuLogs ) {
                mapped.push ({
                    user_id               : log.user_id,
                    username              : log.username,
                    tanggal               : log.created_at,
                    bank_operator         : log.bank_name,
                    vendor                : "Duitku",
                    bank_name             : log.bank_name,
                    bank_account          : log.bank_account,
                    user_amount_deduction : log.amount + 5000,
                    nominal               : log.amount,
                    account_number        : null,
                    price                 : null,
                    type                  : "User Withdraw",
                    status                : log.status,
                })
            }
        const awdLogs = await this.awdService.getUsersAwdLogs(startDate, endDate);
            for (const log of awdLogs ) {
                mapped.push ({
                    user_id               : log.user_id,
                    username              : log.username,
                    tanggal               : log.created_at,
                    bank_operator         : log.operator_name,
                    vendor                : "AWD",
                    bank_name             : null,
                    bank_account          : null,
                    user_amount_deduction : log.price,
                    nominal               : null,
                    account_number        : log.number,
                    price                 : log.price,
                    type                  : "User Purchase",
                    status                : log.status,

                })
            }
        return mapped;
    }

    public async checkForUpdate(currentVersion: string): Promise<boolean> {
        const minVersionConfig         = await this.appConfigService.getConfigByKey(APP_CONFIG_KEY.minVersion);

        if(!minVersionConfig) return true

        const minVersion = Number(minVersionConfig.config_value);
        console.log("CURRENT VErSION", currentVersion);
        console.log("MIN VERSION", minVersion);
        if (currentVersion == "" || minVersion > Number(currentVersion)) {
            return true;
        }

        return false
    }

    public async createUserGopayId(gopay_id: string): Promise<Users>{
        let user = await this.dbConn.getRepository(Users).save({
            email                       : '',
            gopay_id                    : gopay_id,
            lucky_wheel_spin_entries    : LUCKY_WHEEL_SPIN_ENTRIES,
            username                    : "Player_" + this.helperService.generateRandomNumber(8),
            is_confirmed                : true
        });

        return user;
    }

    public async checkUsernameExists(username: string): Promise<boolean>{
        let user    = await this.dbConn.getRepository(Users)
                    .createQueryBuilder("users")
                    .where("LOWER(users.username) = LOWER(:username)", {username: username})
                    .andWhere('users.deleted_at IS NULL')
                    .getOne();

        if(user){
            return true;
        }

        return false;
    }

    public async isGopayUser(userId: number): Promise<boolean> {
        const user = await this.dbConn.getRepository(Users)
            .createQueryBuilder("users")
            .where("users.id = :userId", {userId})
            .andWhere('users.deleted_at IS NULL')
            .getOne();

        return user?.gopay_id !== null && user?.gopay_id !== undefined;
    }

    public async isVip(userId: number): Promise<boolean> {
        const user = await this.dbConn.getRepository(Users)
            .createQueryBuilder("users")
            .where("users.id = :userId", {userId})
            .andWhere('users.deleted_at IS NULL')
            .getOne();

        return user?.vip === true;
    }
}
