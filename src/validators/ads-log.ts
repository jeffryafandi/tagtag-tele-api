import { IsDefined, IsEnum, IsOptional, IsString } from "class-validator";

export type AdsLogsPayload = {
    type            : "interstitial" | "rewarded";
    source_type     : string;
    source_code     : string;
    status          : "skip" | "full";
    partner_ad_id   : number | undefined;
}

export enum AdsLogType {
    interstitial    = 'interstitial',
    rewarded        = 'rewarded'
}

export enum AdsLogStatus {
    skip        = 'skip',
    full        = 'full'
}
export class LoggingAdsRules {
    @IsDefined()
    @IsEnum(AdsLogType,{message: 'type must be one of the following values: `interstitial`, `rewarded`'})
    type!: string;
    
    @IsDefined()
    @IsEnum(AdsLogStatus,{message: 'status must be one of the following values: `skip`, `full`'})
    status!: string;

    @IsDefined()
    @IsString()
    source_code!: string;

    @IsDefined()
    @IsString()
    source_type!: string;

    @IsOptional()
    partner_ad_id?: number;
}