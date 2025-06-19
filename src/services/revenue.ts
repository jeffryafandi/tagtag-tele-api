import { Users } from "../entities/users";
import { RevenueBaselines } from "../entities/revenue-baselines";
import { BaseService } from "./base";
import { UserRevenues } from "../entities/user-revenues";
import { UserService } from "./user";
import { Connection } from "typeorm";
import { AdsLogService } from "./ads-log";
import { InAppPurchaseService } from "./in-app-purchase";
import { 
    CreateRevenueBaselineRequest,
    FilterRevenue,
    RevenueBaselineSchema,
    UserCommissionData,
    UserRevenueBaseTotals,
    UserRevenueSchema 
} from "../interfaces/requests/revenue";
import { AffiliateBenefitService } from "./affiliate-benefit";
import { AffiliateBenefitTierings } from "../entities/affiliate_benefit_tierings";
import { AffiliateService } from "./affiliate";
import { TransactionService } from "./transaction";
import { TRANSACTION_AVAILABLE_CODE } from "../config/constants";
import { InAppPurchases } from "../entities/in-app-purchases";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import dayjs from "dayjs";
import { ROWS_PER_PAGE } from "../config/constants";


export class RevenueService extends BaseService {
    protected userService           : UserService;
    protected adsLogService         : AdsLogService;
    protected inAppPurchaseService  : InAppPurchaseService;
    protected benefitService        : AffiliateBenefitService;
    protected affiliateService      : AffiliateService;
    protected transactionService    : TransactionService;

    constructor(dbConn: Connection) {
        super(dbConn);
        this.userService            = new UserService(dbConn);
        this.adsLogService          = new AdsLogService(dbConn);
        this.inAppPurchaseService   = new InAppPurchaseService(dbConn);
        this.benefitService         = new AffiliateBenefitService(dbConn);
        this.affiliateService       = new AffiliateService(dbConn);
        this.transactionService     = new TransactionService(dbConn);
    }

    public calculateTotalAdsRevenue(baselineValue: number, totalAds: number): number {
        return (baselineValue * (totalAds/1000));
    }

    public calculateTotalPurchaseRevenue(purchases: InAppPurchases[]): number {
        let totalPurchase   = 0;
        purchases.forEach((purchase) => {
            totalPurchase   += purchase.price;
        });
        return totalPurchase;
    }

    public async calculateUserRevenue(user: Users, baseline: RevenueBaselines): Promise<UserRevenueBaseTotals> {
        const baselineValue = this.calculateBaselineValue(baseline);
        const startDate     = baseline.start_date;
        const endDate       = baseline.end_date;
        const tierings      = await this.benefitService.getAllTierings();

        let mergedUserIds: number[] = user.affiliate ? user.affiliate?.affiliateUsers.map((affiliateUser) => affiliateUser.user_id) : [];
        // mergedUserIds.push(user.id);

        const [ads, count]          = await this.adsLogService.getLogsForUsersByPeriod(mergedUserIds, startDate, endDate);
        const purchases             = await this.inAppPurchaseService.getUsersPurchaseByPeriod(mergedUserIds, startDate, endDate);
        const totalAdsRevenue       = this.calculateTotalAdsRevenue(baselineValue, count);
        const totalPurchaseRevenue  = this.calculateTotalPurchaseRevenue(purchases);
        // const possibleTiering       = this.getPossibleTiering((totalAdsRevenue + totalPurchaseRevenue), tierings);
        const userTiering           = tierings.filter((tier) => tier.affiliate_benefit_id == user.affiliate?.affiliate_benefit_id);
        return {
            total_ads_revenue           : totalAdsRevenue,
            total_purchase_revenue      : totalPurchaseRevenue,
            total_withdrawable_ads      : this.calculateWithdrawableAmount(totalAdsRevenue, userTiering[0]),
            total_withdrawable_purchase : this.calculateWithdrawableAmount(totalPurchaseRevenue, userTiering[0])
        }
    }

    public async bulkStoreUserRevenue(data: UserRevenueSchema[]) {
        await this.dbConn.getRepository(UserRevenues)
        .createQueryBuilder()
        .insert()
        .into(UserRevenues)
        .values(data)
        .execute();
    }

    public async generateAllUsersRevenue(baseline: RevenueBaselines | null): Promise<void> {
        if (!baseline) return;
        const users = await this.userService.getAllUserAffiliates();
        const newUserRevenueData: UserRevenueSchema[] = []
        await Promise.all(users.filter((user) => {
            if (!user.affiliate) return false;
            return user.affiliate.affiliateUsers.length > 0;
        }).map(async (user) => {
            const {
                total_ads_revenue,
                total_purchase_revenue,
                total_withdrawable_ads,
                total_withdrawable_purchase
             } = await this.calculateUserRevenue(user, baseline);
             if (total_withdrawable_ads > 0 || total_withdrawable_purchase > 0) {
                 newUserRevenueData.push({
                     user_id             : user.id, 
                     revenue_baseline_id : baseline.id, 
                     total_ads_revenue, 
                     total_purchase_revenue, 
                     total_withdrawable_ads, 
                     total_withdrawable_purchase 
                 });
             }
        }));
        await this.bulkStoreUserRevenue(newUserRevenueData);
    }

    public async destroyUserRevenueByBaseline(baseline: RevenueBaselines) {
        await this.dbConn.getRepository(UserRevenues).delete({revenue_baseline_id: baseline.id});
    }

    public async fetchLatestUnpublishedBaseline(): Promise<RevenueBaselines|null> {
        return await this.dbConn.getRepository(RevenueBaselines)
        .findOne({
            where: {
                is_published: false
            },
            order: {
                created_at: 'DESC'
            }
        });
    }

    public async fetchLatestPublishedBaseline(): Promise<RevenueBaselines|null> {
        return await this.dbConn.getRepository(RevenueBaselines)
        .findOne({
            where: {
                is_published: true
            },
            order: {
                created_at: 'DESC'
            }
        });
    }

    public async storeRevenueBaseline(payload: RevenueBaselineSchema) {
        return await this.dbConn.getRepository(RevenueBaselines).save(payload)
    }

    public calculateBaselineValue (baseline: RevenueBaselines) {
        const calculateCpmPrizePool = baseline.cpm - baseline.prize_pool_rate;
        return (calculateCpmPrizePool) - ((calculateCpmPrizePool) * baseline.platform_rate);
    }

    public async updateRevenueBaseline(baseline: RevenueBaselines, payload: QueryDeepPartialEntity<RevenueBaselines>) {
        return await this.dbConn.getRepository(RevenueBaselines)
        .createQueryBuilder()
        .update()
        .set(payload)
        .where("id = :id", {id: baseline.id})
        .execute();
    }

    /**
     * @method initiateRevenueBaseline
     * This method is used to create revenue baseline
     * Not only that, it's also generating userRevenue based on the inserted baseline
     * 
     * @param payload {value: number, startDate: string, endDate: string}
     */
    public async initiateRevenueBaseline(payload: CreateRevenueBaselineRequest): Promise<RevenueBaselines|null> {
        let baseline = await this.fetchLatestUnpublishedBaseline();
        if (!baseline) {
            baseline = await this.storeRevenueBaseline(payload);
        } else {
            await this.updateRevenueBaseline(baseline, payload);
            baseline = await this.fetchLatestUnpublishedBaseline();
        }
        return baseline;
    }

    public async getAllRevenueUsersByBaseline(baseline: RevenueBaselines): Promise<UserRevenues[]> {
        return await this.dbConn.getRepository(UserRevenues)
        .createQueryBuilder('userRevenues')
        .leftJoinAndSelect('userRevenues.user', 'users')
        .leftJoinAndSelect('users.affiliate', 'affiliate')
        .where("userRevenues.revenue_baseline_id = :id", {id: baseline.id})
        .getMany();
    }

    public calculateWithdrawableAmount(revenueValue: number, benefitTier: AffiliateBenefitTierings): number {
        return revenueValue * benefitTier.value;
    }

    public getPossibleTiering(revenue: number, tierings: AffiliateBenefitTierings[]): AffiliateBenefitTierings {
        const possibleTierings  = tierings.filter((tiering) => {
            if (tiering) {
                return tiering.threshold > revenue;
            }
            return false;
        });
        // sort tierings from the lowest threshold
        possibleTierings.sort((a, b) => a.threshold - b.threshold)
        
        const currentTier = possibleTierings[0];
        return currentTier;
    }

    public async generateUsersWithdrawableAmount(userRevenues: UserRevenues[]): Promise<void> {
        const tierings = await this.benefitService.getAllTierings();
        await Promise.all(userRevenues.map(async (userRevenue) => {
            const totalWithdrawAmount   = userRevenue.total_withdrawable_ads + userRevenue.total_withdrawable_purchase;
            const user                  = userRevenue?.user
            if (!user) return;
            
            const totalRevenue      = userRevenue.total_ads_revenue + userRevenue.total_purchase_revenue;
            const userCurrentTier   = this.getPossibleTiering(totalRevenue, tierings);
            
            // update user affiliate benefit_id
            // if (user.affiliate) {
            //     await this.affiliateService.updateAffiliateById(user.affiliate.id, {affiliate_benefit_id: userCurrentTier.affiliate_benefit_id});
            // }
            
            // update user withrawable_amount
            await this.userService.update(user, {withdrawable_amount: user.withdrawable_amount + totalWithdrawAmount});
            const updatedUser = await this.userService.getUser(user);
            const transactionPayload = {
                description : 'Revenue Baseline Published',
                code        : TransactionAvailableCodeEnum.REVENUE_PUBLISHED,
                extras      : '',
                details     : [{
                    type            : 'CR',
                    currency        : TransactionDetailCurrencyEnum.WITHDRAW_AMOUNT,
                    value           : totalWithdrawAmount,
                    previous_value  : user.withdrawable_amount,
                    current_value   : updatedUser?.withdrawable_amount || 0
                }] as TransactionDetailRequest[]
            };
    
            await this.transactionService.storeUserTransaction(user, transactionPayload);
        }));
    }

    /**
     * @method publishBaseline
     * This method to publish the unpublished baseline
     * It's including adding the revenue value to all users
     */
    public async publishBaseline(): Promise<RevenueBaselines|null> {
        let unpublishBaseline = await this.fetchLatestUnpublishedBaseline();
        
        if (!unpublishBaseline) {
            const previousPublished = await this.fetchLatestPublishedBaseline();
            const newStartDate      = previousPublished?.start_date ? dayjs(previousPublished.start_date).add(1, 'day').format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss');
            const newEndDate        = previousPublished?.end_date ? dayjs(previousPublished.end_date).add(1, 'day').format('YYYY-MM-DD HH:mm:ss') : dayjs(newStartDate).add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
            const newBaseline       = await this.initiateRevenueBaseline({
                cpm             : previousPublished?.cpm || 0,
                prize_pool_rate : previousPublished?.prize_pool_rate || 0,
                platform_rate   : previousPublished?.platform_rate || 0,
                start_date      : newStartDate,
                end_date        : newEndDate
            });
            unpublishBaseline = newBaseline;
        }

        if (!unpublishBaseline) return null;
        
        if (dayjs().format('YYYY-MM-DD HH:mm:ss') < dayjs(unpublishBaseline.end_date).format('YYYY-MM-DD HH:mm:ss')) {
            return null;
        }

        await this.destroyUserRevenueByBaseline(unpublishBaseline);
        await this.generateAllUsersRevenue(unpublishBaseline)
        const userRevenues  = await this.getAllRevenueUsersByBaseline(unpublishBaseline);
        const haveRevenue   = userRevenues.filter((userRevenue) => (userRevenue.total_ads_revenue > 0 || userRevenue.total_purchase_revenue > 0));
        await this.generateUsersWithdrawableAmount(haveRevenue);
        await this.updateRevenueBaseline(unpublishBaseline, {is_published: true});

        return unpublishBaseline;
    }

    public async fetchUserCommissionByYear(user: Users, year: number | undefined = undefined): Promise<RevenueBaselines[]> {
        const revenueBaselinesQuery = this.dbConn.getRepository(RevenueBaselines)
        .createQueryBuilder('revenueBaselines')
        .leftJoinAndSelect('revenueBaselines.userRevenues', 'userRevenues')
        .where('userRevenues.revenue_baseline_id IS NOT NULL')
        .select('date_format(userRevenues.created_at, "%M") as monthly')
        .addSelect('sum(userRevenues.total_withdrawable_ads) as total_withdrawable_ads')
        .addSelect('sum(userRevenues.total_withdrawable_purchase) as total_withdrawable_purchase')
        .addSelect('userRevenues.created_at as created_at')
        .addSelect('userRevenues.user_id')
        .andWhere('userRevenues.user_id = :userId', {userId: user.id});

        if (year) {
            revenueBaselinesQuery.andWhere('year(userRevenues.created_at) = :year', {year});
        }
        revenueBaselinesQuery.groupBy('date_format(userRevenues.created_at, "%M")')
        return await revenueBaselinesQuery.orderBy('userRevenues.created_at', 'DESC').getRawMany();
    }

    public mapUserCommissionData(rawData: any): UserCommissionData|null {
        return {
            id                          : rawData.userRevenues_user_id,
            month                       : this.helperService.translateMonthToBahasa(rawData.monthly),
            year                        : new Date(rawData.created_at).getFullYear(),
            total_commission            : Number(rawData.total_withdrawable_ads) + Number(rawData.total_withdrawable_purchase),
            total_ads_commission        : Number(rawData.total_withdrawable_ads),
            total_purchase_commission   : Number(rawData.total_withdrawable_purchase)
        }
    }

    public async getUserYearlyCommission(user: Users, year: number | undefined = undefined): Promise<UserCommissionData[]> {
        const revenueBaselines  = await this.fetchUserCommissionByYear(user, year);
        const nowMonth          = new Date().getMonth();
        const mappedData        = revenueBaselines.filter((rawData: any) => {
            const monthIndex = this.helperService.getMonthIndex(rawData.monthly);
            return monthIndex < nowMonth;
        }).map((baseline) => {
            return this.mapUserCommissionData(baseline)
        }).filter((v) => v) as UserCommissionData[];

        return mappedData;
    }

    public async usersRevenueDetail(input: FilterRevenue | null, startDate: string, endDate: string): Promise <[UserRevenues[], number]> {
        let logs = this.dbConn.getRepository(UserRevenues)
                    .createQueryBuilder('userRevenues')
                    .leftJoinAndSelect('userRevenues.user', 'user')
                    .leftJoinAndSelect('userRevenues.revenueBaseline', 'revenueBaseline')
                    .select([
                        'userRevenues.user_id as user_id',
                        'user.username as username',
                        'userRevenues.revenue_baseline_id as revenue_baseline_id',
                        'userRevenues.total_ads_revenue as total_ads_revenue ',
                        'userRevenues.total_purchase_revenue as total_purchase_revenue',
                        'userRevenues.total_withdrawable_ads as total_withdrawable_ads ',
                        'userRevenues.total_withdrawable_purchase as total_withdrawable_purchase ',
                        'userRevenues.created_at as created_at'
                    ])
                    .where('userRevenues.deleted_at is NULL');

         if(input != null){
            if(input.id){
                logs.andWhere('userRevenues.id = :id', {id: input.id});
            }
            if(startDate && endDate){
                logs.andWhere('userRevenues.created_at BETWEEN :startDate and :endDate', {startDate: startDate, endDate: endDate });
            }
            if(input.page){
                logs.skip((input.page - 1) * ROWS_PER_PAGE);
                logs.take(ROWS_PER_PAGE);
            }
        }
      
        let result = await logs.getRawMany();

        return [result, result.length];

    }
}
