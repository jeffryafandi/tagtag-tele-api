export enum PrizeDistributionsType {
    weekly  = 'weekly',
    daily   = 'daily'
}

export enum IncrementLogSource {
    ads      = 'ads',
    purchase = 'purchase'
}

export interface BasePrizepoolSchema {
    total_pools                     : number;
    start_date                      : string;
    end_date                        : string;
    increment_value_ads_rewarded    : number;
    increment_value_ads_interstitial: number;
    value_per_purchase              : number;
    daily_distributions             : string;
    weekly_distributions            : string;
    is_active                       ?: boolean
}

export type PrizepoolDayRequest = {
    date                            : string;
    prizepools_percentage           : number;
    increment_value_ads_rewarded    : number;
    increment_value_ads_interstitial: number;
}

export interface PrizepoolInitRequest extends Omit<BasePrizepoolSchema, 'daily_distributions' | 'weekly_distributions'> {
    daily_distributions     : number[];
    weekly_distributions    : number[];
    days                    : PrizepoolDayRequest[];
}