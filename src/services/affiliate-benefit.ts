import { AffiliateBenefitTierings } from "../entities/affiliate_benefit_tierings";
import { AffiliateBenefits, benefitAvailableFilter } from "../entities/affiliate-benefits";
import { BaseService } from "./base";

export class AffiliateBenefitService extends BaseService {
    public async getBenefitList(filter: benefitAvailableFilter | undefined = undefined): Promise<AffiliateBenefits[]> {
        const query     = this.dbConn.getRepository(AffiliateBenefits).createQueryBuilder('affiliateBenefits');
        const applyFilter = {deleted_at: null};

        if (filter) {
            Object.keys(filter).map((field: any) => {
                // @ts-ignore
                if (filter[field]) {
                    // @ts-ignore
                    applyFilter[field] = filter[field];
                }
            });
        }

        query.where(applyFilter);
        query.leftJoinAndSelect('affiliateBenefits.affiliateBenefitTierings', 'affiliateBenefitTierings');
        
        return await query.getMany();
    }

    public async findBenefitByName(name: string): Promise<AffiliateBenefits|null> {
        return await this.dbConn.getRepository(AffiliateBenefits)
        .findOne({
            where: {name},
            join: {
                alias: 'affiliateBenefits',
                leftJoinAndSelect: {
                    tiering: 'affiliateBenefits.affiliateBenefitTierings'
                }
            }
        });
    }

    public async getAllTierings(): Promise<AffiliateBenefitTierings[]> {
        return await this.dbConn.getRepository(AffiliateBenefitTierings)
        .createQueryBuilder()
        .getMany();
    }

    public mapBenefitResponse(benefits: AffiliateBenefits[]) {
        return benefits.map((benefit) => {
            return {
                id              : benefit.id,
                type            : benefit.type,
                commission_type : benefit.commission_type,
                name            : benefit.name,
                description     : benefit.description,
                value           : benefit.value * 100,
                tierings        : benefit.affiliateBenefitTierings?.map((tiering) => {
                    return {
                        threshold   : tiering.threshold,
                        value       : tiering.value * 100
                    }
                })
            };
        });
    }
}