import { ArrayNotEmpty, IsArray, IsBoolean, IsDefined, IsNumber, IsOptional, IsString, Min, Validate, ValidateNested } from "class-validator";
import { CustomIsDateValidator } from "./revenue";
import { Type } from "class-transformer";

export class PrizepoolDaysRules {
    @IsDefined()
    @Validate(CustomIsDateValidator)
    date!: string

    @IsDefined()
    @IsNumber({allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2}, { each: true })
    prizepools_percentage!: number    
}

export type PrizepoolIncrementLogPayload = {
    source          : "ads" | "purchase";
    increment_value : number;
    user_id         : number;
    prizepool_id    : number;
    source_id       : number;
}

export class GetPrizepoolWinnersRules {
    @IsDefined()
    @Validate(CustomIsDateValidator)
    date!: string
}

export class InitPrizepoolRules {
    @IsDefined()
    @Validate(CustomIsDateValidator)
    start_date!: string

    @IsDefined()
    @Validate(CustomIsDateValidator)
    end_date!: string

    @IsDefined()
    @IsNumber({allowInfinity: false, allowNaN: false, maxDecimalPlaces: 0})
    @Min(1)
    total_pools!: number;

    @IsDefined()
    @IsNumber()
    @Min(1)
    increment_value_ads_interstitial!: number
    
    @IsDefined()
    @IsNumber()
    @Min(1)
    increment_value_ads_rewarded!: number
    
    @IsDefined()
    @IsNumber()
    @Min(0.1)
    value_per_purchase!: number
    
    @IsDefined()
    @IsArray()
    @IsNumber({allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2}, { each: true })
    daily_distributions!: number[]

    @IsDefined()
    @IsArray()
    @IsNumber({allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2}, { each: true })
    weekly_distributions!: number[]

    @IsDefined()
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true, message: "Days should not be empty object" })
    @Type(() => PrizepoolDaysRules)
    days!: PrizepoolDaysRules[];
}