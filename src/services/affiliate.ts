import { Affiliates } from "../entities/affiliates";
import { BaseService } from "./base";
import { 
    UpgradeAffiliateRequest,
    AffiliateUpgradeSocialsRequest,
    UpdateStatusAffiliateRequest,
    AvailableAffiliateStatus,
    RejectReason
} from "../interfaces/requests/users";
import { AffiliateUpgradeRequests } from "../entities/affiliate-upgrade-requests";
import { AffiliateUpgradeRequestSocials } from "../entities/affiliate-upgrade-request-socials";
import { QueryPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { AffiliateBenefitService } from "./affiliate-benefit";
import { Connection } from "typeorm";
import { EmailService } from "./email";
import { Users } from "../entities/users";
import { AffiliateUsers } from "../entities/affiliate-users";
import { TelegramService } from "./telegram";

export class AffiliateService extends BaseService {
    protected affiliateBenefitService   : AffiliateBenefitService;
    protected emailService              : EmailService;
    protected telegramService           : TelegramService;

    constructor(connection: Connection) {
        super(connection);
        this.affiliateBenefitService    = new AffiliateBenefitService(connection);
        this.emailService               = new EmailService();
        this.telegramService            = new TelegramService();
    }

    public async updateAffiliateById(affiliateId: number, schema: QueryPartialEntity<Affiliates>) {
        await this.dbConn.getRepository(Affiliates)
        .createQueryBuilder()
        .update()
        .set(schema)
        .where({id: affiliateId})
        .execute();
    }

    public async affiliateUpgradeRequest(affiliate: Affiliates, input: UpgradeAffiliateRequest): Promise<AffiliateUpgradeRequests | undefined>{
        const affiliateUpgrade = await this.dbConn.getRepository(AffiliateUpgradeRequests).save({
            affiliate_id        : affiliate.id,
            previous_benefit_id : affiliate.affiliate_benefit_id,
            name                : input.name,
            description         : input.description,
            phone_number        : input.phone_number,
            email               : input.email,
            status              : 'pending',
        });
        await this.emailService.sendAffiliateUpgradePending(affiliate.user, affiliate.affiliateBenefit);
        await this.telegramService.sendMessageAffiliateRequest(affiliate.user, affiliate, affiliateUpgrade);

        if(affiliateUpgrade == undefined){
            return undefined;
        }

        return affiliateUpgrade;
    }

    public async AffiliateSocialRequest(input: AffiliateUpgradeSocialsRequest): Promise< AffiliateUpgradeRequestSocials>{
        const affiliateSocialRequest = await this.dbConn.getRepository(AffiliateUpgradeRequestSocials).save({
            affiliate_upgrade_request_id : input.affiliateUpgradeRequests.id,
            type                         : input.type,
            link                         : input.link,
        });

        return affiliateSocialRequest;    
    }

    public async findAffiliateUpgradeById(id: number): Promise<AffiliateUpgradeRequests|null> {
        return await this.dbConn.getRepository(AffiliateUpgradeRequests)
        .findOne({
            where: {
                id
            },
            join: {
                alias: 'affiliateUpgrades',
                leftJoinAndSelect: {
                    affiliate   : 'affiliateUpgrades.affiliates',
                    user        : 'affiliate.user',
                    benefit     : 'affiliate.affiliateBenefit'
                }
            }
        });
    }

    public async updateAffiliateUpgrade(affiliateUpgrade: AffiliateUpgradeRequests, schema: QueryPartialEntity<AffiliateUpgradeRequests>) {
        await this.dbConn.getRepository(AffiliateUpgradeRequests)
        .update(affiliateUpgrade.id, schema);
    }

    public async assignUserToAffiliator(affiliator: Affiliates, user: Users): Promise<AffiliateUsers> {
        return await this.dbConn.getRepository(AffiliateUsers).save({
            affiliate_id: affiliator.id,
            user_id     : user.id
        });
    }

    public async updateAffiliateUpgradeStatus(affiliateUpgradeID: number, payload: UpdateStatusAffiliateRequest): Promise<boolean> {
        const upgradeRequest = await this.findAffiliateUpgradeById(affiliateUpgradeID);
        if (!upgradeRequest) throw Error('No Affiliate Upgrade found!');

        const benefit = await this.affiliateBenefitService.findBenefitByName(payload.tier);
        if (payload.tier && !benefit) throw Error('No benefit tiering is found!');

        await this.updateAffiliateUpgrade(upgradeRequest, {status: payload.status});

        if (payload.status == AvailableAffiliateStatus.approved) {
            if (benefit) {
                await this.updateAffiliateById(upgradeRequest.affiliate_id, {affiliate_benefit_id: benefit?.id, status: payload.status});
                await this.emailService.sendAffiliateUpgradeApproved(upgradeRequest.affiliates?.user, upgradeRequest.affiliates?.affiliateBenefit, benefit);
                return true;
            }
        }
        
        if (payload.status == AvailableAffiliateStatus.rejected) {
            if (benefit){
                if (payload.reason == RejectReason.duplicate) {
                    await this.emailService.sendAffiliateUpgradeRejectedDuplicateSocial(upgradeRequest.affiliates?.user, benefit);
                }
                if (payload.reason == RejectReason.folls) {
                    await this.emailService.sendAffiliateUpgradeRejectedNotEnoughFolls(upgradeRequest.affiliates?.user, benefit);
                }
                if (payload.reason == RejectReason.incorrect) {
                    await this.emailService.sendAffiliateUpgradeRejectedIncorrectLink(upgradeRequest.affiliates?.user, benefit);
                }
            }
            return true;
        }

        return false;
    }

    public async getAllAffiliateUsers(startDate: string, endDate: string): Promise<AffiliateUsers[]>{
        const user    = await this.dbConn.getRepository(AffiliateUsers)
                    .createQueryBuilder("affiliateUsers")
                    .where("affiliateUsers.deleted_at IS NULL")
                    .andWhere('affiliateUsers.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
                    .getMany()

        return user;
    }

}

