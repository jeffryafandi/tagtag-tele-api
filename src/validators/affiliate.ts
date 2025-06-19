import { IsDefined, IsEnum, IsOptional } from "class-validator";
import { benefitCommissionType, benefitType } from "../interfaces/requests/benefit";
import { AvailableAffiliateStatus, RejectReason } from "../interfaces/requests/users";

export class GetBenefitQueryRules {
    @IsDefined()
    @IsEnum(benefitType, {message: 'commission_type must be one of the following values: `kol`, `b2b`'})
    type!: string;

    @IsOptional()
    @IsEnum(benefitCommissionType, {message: 'commission_type must be one of the following values: `basic`, `tiering`'})
    commission_type?: string
}

export class UpgradeAffiliateRequestRules {
    @IsDefined()
    name!           : string;
    description!    : string;
    phone_number!   : string;
    email!          : string;
}

export class UpdateAffiliateStatusRules {
    @IsDefined()
    @IsEnum(AvailableAffiliateStatus ,{message: 'status must be one of the following values: `approved`, `rejected`'})
    status!: string;
    
    @IsEnum(RejectReason ,{message: 'reason must be one of the following values: `duplicate`, `folls`, `incorrect`'})
    reason?: string;

    @IsOptional()
    tier?: string;
}

export class RejectAffiliateStatusRules {
    @IsDefined()
    @IsEnum(AvailableAffiliateStatus ,{message: 'status must be one of the following values: `approved`, `rejected`'})
    status!: string;
}