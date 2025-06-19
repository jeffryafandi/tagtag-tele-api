import { DeepPartial } from "typeorm";
import { Partners } from "../entities/partners";
import { BaseService } from "./base";
import { PartnerAds } from "../entities/partner-ads";
import { AdsLogType } from "../validators/ads-log";

export class PartnerService extends BaseService {
    public async store(schema: DeepPartial<Partners>): Promise<Partners> {
        return await this.dbConn.getRepository(Partners).save(schema);
    }
    public async fetchPartnerByName(name: string): Promise<Partners|null> {
        return await this.dbConn.getRepository(Partners).findOne({where: { name }});
    }
    public async fetchPartnerById(id: number): Promise<Partners|null> {
        return await this.dbConn.getRepository(Partners).findOne({where: { id }});
    }
    public async storeAdForPartner(schema: DeepPartial<PartnerAds>): Promise<PartnerAds> {
        return await this.dbConn.getRepository(PartnerAds).save(schema);
    }
    public async fetchPartnerAdById(id: number): Promise<PartnerAds|null> {
        return await this.dbConn.getRepository(PartnerAds).findOne({where: { id }});
    }
    public async fetchRandomPartnerAdByType(type: AdsLogType): Promise<PartnerAds|null> {
        const randomAds = `
            SELECT 
                partnerAds.id AS partner_ad_id 
            FROM 
                partner_ads partnerAds
            WHERE 
                type="${type}" 
            ORDER BY RAND() limit 1;
        `;
        let partnerAdId = 0;
        let result      = await this.dbConn.query(randomAds);

        if (result.length > 0) {
            const rowData   = result[0];
            partnerAdId     = rowData['partner_ad_id'];

            if (!partnerAdId) return null;
        }
        
        return await this.fetchPartnerAdById(partnerAdId);
    }
}