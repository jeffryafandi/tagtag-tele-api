export const ROWS_PER_PAGE                      = 15;
export const ROWS_PER_PAGE_LUCKY_WHEEL          = 25;
export const SHA_256_SALT                       = 'nominaku';
export const BOOSTER_DURATION                   = 5;
export const REFERRAL_COUPONS                   = 10;
export const MIN_INQUIRY_AMOUNT                 = 15000;
export const AFFILIATE_BENEFIT_ID               = 1;
export const LUCKY_WHEEL_SPIN_ENTRIES           = 1;
export const EXTRA_LIFE_PLAY_COUNT_LIMIT        = 5;
export const RAFFLE_TICKET_CHUNK_SIZE           = 1000;
export const ASSIGN_USER_QUEST_CHUNK_SIZE       = 500;
export const ASSIGN_USER_QUEST_CHUNK_SIZE2      = 1000;
export const MESSAGE_CHUNK_SIZE                 = 100;
export const AFFILIATES_BONUS_COIN              = 5000;
export const AFFILIATES_BONUS_COUPON            = 10000;
export const RAFFLE_TICKET_LIMIT                = 10000;
export const SUBTRACT_DAY                       = 6;
export const ALLOW_NOTIF_CONFIG_KEY             = 'allow_send_notif';
export const STAMINA_ENTRIES                    = 50;
export const MAX_USERNAME_CHAR                  = 16;
export const REDIS_TTL_DAILY_LEADERBOARD        = 30;
export const REDIS_TTL_WEEKLY_LEADERBOARD       = 30;
export const REDIS_TTL_PRIZEPOOL_WINNER         = 1440; // 1 day
export const REDIS_TTL_TOTAL_POOLS              = 30;
export const REDIS_TTL_USER_MISSION_SESSION     = 10; // seconds
export const QUEST_PRESET_VIP_ID                = 2;
export const QUEST_PRESET_REGULAR_ID            = 1;
export const MISSION_PRESET_VIP_ID              = 2;
export const MISSION_PRESET_REGULAR_ID          = 1;
export const REWARDED_ADS_USER_LIMIT            = 3;
export const VIP_QUEST_DAILY_LOGIN_ID           = [1];
export const VIP_QUEST_DAILY_MISSION_ID         = [2,3];
export const VIP_QUEST_LUCKY_WHEEL_SPIN_ID      = [4];
export const VIP_QUEST_DAILY_QUEST_ID           = [5,6];
export const VIP_QUEST_DAILY_FREEPLAY_ID        = [7];
export const VIP_QUEST_DAILY_WITHDRAW_ID        = [8];
export const VIP_QUEST_DAILY_REWARDED_ADS_ID    = [9];
export const VIP_QUEST_DAILY_RAFFLE_ID          = [10];
export enum STATUS {
    OPEN    = "open",
    PENDING = "pending",
    CLOSED  = "closed"
};

export const TRANSACTION_AVAILABLE_CODE = {
    DAILY_LOGIN_CLAIM   : "DAILY_LOGIN_CLAIM",
    REFERRAL_CLAIM      : "REFERRAL_CLAIM",
    MISSION_REWARD      : "GAME_MISSION_REWARD",
    QUEST_REWARD        : "GAME_QUEST_REWARD",
    LUCKY_WHEEL_REWARD  : "LUCKY_WHEEL_REWARD",
    IN_APP_PURCHASE     : "IN_APP_PURCHASE",
    WON_RAFFLE          : "RAFFLE_REWARD",
    SUBMIT_RAFFLE       : "RAFFLE_SUBMIT",
    BASELINE_PUBLISHED  : "REVENUE_BASELINE_PUBLISHED",
    USER_WITHDRAW       : "USER_WITHDRAW",
    ACTIVITY_BONUS      : "ACTIVITY_BONUS",
    PRIZEPOOL_REWARD    : "PRIZEPOOL_REWARD",
    WEEKLY_PRIZEPOOL_WIN: "WEEKLY_PRIZEPOOL_WIN",
    ADMIN_USER_UPDATE   : "ADMIN_USER_UPDATE"
}

export const TRANSACTION_DESCRIPTIONS = {
    WON_LUCKY_WHEEL         : 'User won lucky wheel',
    FINISHED_MISSION        : 'User finished mission',
    PLAY_MISSION            : 'User Play mission',
    FINISHED_QUEST          : 'User finished quest',
    PLAY_QUEST              : 'User Play quest',
    PLAY_FREEPLAY           : 'User Play freeplay',
    IN_APP_PURCHASE         : 'User Purchase',
    IN_APP_REFUND           : 'User Purchase cancelled/refunded',
    WON_RAFFLE              : 'User raffles prize',
    SUBMIT_RAFFLE           : 'User submit to Raffle',
    WON_PRIZEPOOL           : 'User won prizepool',
    WON_PRIZEPOOL_W         : 'User win weekly prizepool',
    USER_WITHDRAW           : 'User withdraw',
    USER_REGISTER           : 'User Register',
    USER_COMPLETE_QUEST     : 'User completing the quest',
    USER_COMPLETE_MISSION   : 'User completing the mission',
    USER_CLAIM_MYSTERY_BOX  : 'User claim mystery box',
    FINISHED_FREEPLAY       : 'User finished freeplay',
    FINISHED_VIP_QUEST      : 'User finished vip quest',
    FINISHED_REWARDED_ADS   : 'User finished rewarded ads'
}

export const IN_APP_PURCHASE_STATUS = {
    PURCHASE    : "PURCHASED",
    UNKNOWN     : "UNKNOWN",
    PENDING     : "PENDING",
    FAILED      : "FAILED"
}

export const INQUIRY_PURPOSES = {
    CHECK_ACCOUNT_DETAIL: 'Finding Account Detail',
    USER_WITHDRAW       : 'User withdrawing'
}

export const INQUIRY_SENDERS = {
    ADMIN: 'TagTag Admin'
}

export enum INVENTORIES_TYPE {
    IN_GAME = "in_game",
    SHOP    = "shop",
};

export const EXPIRED_TIME_VERIFY_X_API_SECRET = {
    EXPIRED_KEYS: [
        { key: '/lucky-wheels/spin', name: 'SPIN', value: 10 },
        { key: '/lucky-wheels/reset-entries', name: 'RESET_ENTRIES', value: 10 },
        { key: '/quests/:questId/finish', name: 'QUEST_FINISH', value: 10 },
        { key: '/missions/:missionId/finish', name: 'MISSION_FINISH', value: 10 },
        { key: '/auths/withdraw/gopay', name: 'WITHDRAW_GOPAY', value: 10 },
        { key: '/auths/login/google', name: 'LOGIN_GOOGLE', value: 10 },
        { key: '/auths/withdraw/gopay_id', name: 'WITHDRAW_GOPAYID', value: 10 },
        { key: '/freeplay/:gameId/finish', name: 'FREEPLAY_FINISH', value: 10 },
        { key: '/ads/log', name: 'ADS_LOG', value: 10 },
    ]
}