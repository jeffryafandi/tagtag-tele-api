export enum TransactionAvailableCodeEnum {
    DAILY_LOGIN_REWARD  = 'DAILY_LOGIN_REWARD', 
    PLAY_DAILY_QUEST    = 'PLAY_DAILY_QUEST', 
    PLAY_MISSIONS       = 'PLAY_MISSIONS', 
    LUCKY_WHEEL_REWARD  = 'LUCKY_WHEEL_REWARD', 
    RAFFLE_REWARD       = 'RAFFLE_REWARD', 
    PRIZEPOOL_REWARD    = 'PRIZEPOOL_REWARD', 
    USER_PURCHASE       = 'USER_PURCHASE', 
    USER_WITHDRAW       = 'USER_WITHDRAW',
    REFERRAL_CLAIM      = 'REFERRAL_CLAIM',
    REVENUE_PUBLISHED   = 'REVENUE_PUBLISHED',
    ADMIN_USER_UPDATE   = 'ADMIN_USER_UPDATE',
    USER_REGISTER       = 'USER_REGISTER',
    MYSTERY_BOX         = 'MYSTERY_BOX_REWARD',
    PLAY_FREEPLAY       = 'PLAY_FREEPLAY', 
    VIP_QUEST_REWARD    = 'VIP_QUEST_REWARD',
    REWARDED_ADS        = 'REWARDED_ADS'
}

export enum TransactionDetailCurrencyEnum {
    ACTIVITY_POINT  = 'activity_point',
    COIN            = 'coin',
    COUPON          = 'coupon',
    WITHDRAW_AMOUNT = 'withdraw_amount',
    STAMINA         = 'stamina',
    VIP_POINT       = 'vip_point'
}

export type TransactionDetailRequest = {
    type            : 'CR' | 'DB',
    value           : number,
    currency        : TransactionDetailCurrencyEnum,
    previous_value  : number,
    current_value   : number
}

export interface UserStoreNewTransactionRequest {
    description : string,
    code        : TransactionAvailableCodeEnum,
    extras      ?: string
    details     : TransactionDetailRequest[]
}

enum sortByEnum {
    ASC     = "ASC",
    DESC    = "DESC"
}

export interface FilterTransaction {
    id?         : number;
    username?   : string;
    page?       : number;
    sort?       : string;
    sortBy?     : sortByEnum;
};