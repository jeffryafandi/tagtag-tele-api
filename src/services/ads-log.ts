import { Connection } from "typeorm";
import { Prizepools } from "../entities/prizepools";
import { AdsLogs } from "../entities/ads-logs";
import { AdsLogType, AdsLogsPayload } from "../validators/ads-log";
import { BaseService } from "./base";
import { PrizepoolService } from "./prizepool";
import { IncrementLogSource } from "../interfaces/requests/prizepool";
import { PartnerService } from "./partner";
import dayjs from "dayjs";

export class AdsLogService extends BaseService {
    protected prizepoolService  : PrizepoolService;
    protected partnerService    : PartnerService;

    constructor(connection: Connection) {
        super(connection);
        this.prizepoolService   = new PrizepoolService(this.dbConn);
        this.partnerService     = new PartnerService(this.dbConn);
    }

    public async storeAdsLogForUser(userId: number, schema: AdsLogsPayload) {
        const activePrizepool   =  await this.prizepoolService.fetchLatestActivePrizepool();
        let logable_type        = '';
        let logable_id          = 0; 
        
        if (schema.partner_ad_id) {
            const partner   = await this.partnerService.fetchPartnerAdById(schema.partner_ad_id);
            if (!partner) throw Error('partner ad id is invalid!');

            logable_type    = 'partner_ads';
            logable_id      = schema.partner_ad_id;
        }

        const store = await this.dbConn.getRepository(AdsLogs)
        .save({
            type        : schema.type,
            source_type : schema.source_type,
            source_code : schema.source_code,
            user_id     : userId,
            status      : schema.status,
            logable_id  : logable_id,
            logable_type: logable_type
        });

        if (store && activePrizepool) {
            let rewardedAdsIncrement    = activePrizepool.increment_value_ads_rewarded;
            let interstitialAdsIncrement= activePrizepool.increment_value_ads_interstitial;
            const currentTime           = this.helperService.toDateTime(dayjs());

            const currentDailyPrizepool = activePrizepool.dailyPercentages.filter((day) => {
                const start = this.helperService.substractHours(`${day.date} 00:00:00`, 7);
                const end   = this.helperService.substractHours(`${day.date} 23:59:59`, 7);
                if (currentTime >= start && currentTime <= end) {
                    return true;
                }
                return false;
            });

            if ( currentDailyPrizepool.length > 0 ) {
                rewardedAdsIncrement    = currentDailyPrizepool[0].increment_value_ads_rewarded;
                interstitialAdsIncrement= currentDailyPrizepool[0].increment_value_ads_interstitial;
            }

            const data = {
                   prizepool_id     : activePrizepool.id,
                   user_id          : userId,
                   source           : IncrementLogSource.ads,
                   source_id        : store.id,
                   increment_value  : (store.type == AdsLogType.interstitial) ? interstitialAdsIncrement : rewardedAdsIncrement
            }
              
             await this.prizepoolService.storePrizepoolIncrementLog(data)
             
        }
    }


    public async updatePrizepoolByValuePerAds(prizepool: Prizepools): Promise<number> {
        const update = await this.dbConn.getRepository(Prizepools)
                        .createQueryBuilder()
                        .update(Prizepools)
                        .set({
                            total_pools: prizepool.total_pools
                        })
                        .where('is_active = :isActive', {isActive: true})
                        .execute();
        return update.affected || 0;
    }

    public async getLogsForUsersByPeriod(userIds: number[], startDate: string, endDate: string): Promise<[AdsLogs[], number]> {
        return await this.dbConn.getRepository(AdsLogs)
        .createQueryBuilder()
        .where("user_id IN(:...ids)", { ids: userIds })
        .andWhere("created_at between :startDate and :endDate", { startDate, endDate })
        .getManyAndCount()
    }
}
