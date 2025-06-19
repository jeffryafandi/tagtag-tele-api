enum sortByEnum {
    ASC     = "ASC",
    DESC    = "DESC"
}

export interface UserRevenueBaseTotals {
    total_ads_revenue           : number, 
    total_purchase_revenue      : number,
    total_withdrawable_ads      : number,
    total_withdrawable_purchase : number,
}

export interface UserRevenueSchema extends UserRevenueBaseTotals {
    user_id             : number;
    revenue_baseline_id : number;
}

export type RevenueBaselineSchema = {
    cpm             : number;
    prize_pool_rate : number;
    platform_rate   : number;
    start_date      : string;
    end_date        : string;
    is_published    ?: boolean
}

export type CreateRevenueBaselineRequest = {
    cpm             : number;
    prize_pool_rate : number;
    platform_rate   : number;
    start_date      : string,
    end_date        : string
}

export type UserCommissionData = {
    id                          :number;
    month                       :string;
    year                        :number;
    total_commission            :number;
    total_ads_commission        :number;
    total_purchase_commission   :number;
}

export interface FilterRevenue {
    id?         : number;
    page?       : number;
    sort?       : string;
    sortBy?     : sortByEnum;
};
