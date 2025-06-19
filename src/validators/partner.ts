import { IsDefined, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min } from "class-validator";
import { Match } from "./auth";
import { AdsLogType } from "./ads-log";

export class CreatePartnerRules {
    @IsDefined()
    name!: string;

    @IsOptional()
    image_url?: string;    
    
    @IsDefined()
    website!: string;    
}

export class CreatePartnerAdRules {
    @IsDefined()
    @Min(1)
    partner_id!: number;

    @IsDefined()
    @IsEnum(AdsLogType,{message: 'type must be one of the following values: `interstitial`, `rewarded`'})
    type!: string;

    @IsDefined()
    media_url!: string;
    
    @IsDefined()
    media_type!: string;

    @IsDefined()
    @Min(1)
    duration!: number;

    @IsDefined()
    @Min(1)
    min_watch_time!: number;

    @IsOptional()
    @IsUrl()
    action_link?: string;
}

export class GetPartnerAdRules {
    @IsDefined()
    @IsEnum(AdsLogType, {message: 'type must be one of the following values: `interstitial`, `rewarded`'})
    type!: string;
}