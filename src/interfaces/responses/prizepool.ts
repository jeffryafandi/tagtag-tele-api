export interface BasePrizepoolResponse {
    id          : number;
    name        : string;
    total_pools : number;
    start_date  : string;
    end_date    : string;
}

export interface BaseLeaderboardResponse {
    position            : number;
    id                  : number;
    username            : string;
    avatar              : number;
    activity_points     : number;
    distribution_value  : number;
    is_auth_account     : boolean;
}

export interface PrizepoolLeaderboardResponse extends BasePrizepoolResponse {
    leaderboards                    : Array<BaseLeaderboardResponse>;
    auth_position                   ?: BaseLeaderboardResponse;
    auth_position_previous_winner   ?: BaseLeaderboardPreviousWinnerResponse;
}

export interface BaseLeaderboardPreviousWinnerResponse {
    position            : number;
    id                  : number;
    avatar              : number;
    won_prizepool_at    : string;
    can_join_again_at   : string;
}