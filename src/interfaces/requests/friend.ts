export enum FriendStatusEnum {
    pending     = 'pending',
    approved    = 'approved',
    notFriend   = 'not_friend'
}

export enum FriendActivityStatusEnum {
    all     = 'all',
    online  = 'online',
    offline = 'offline'
}

export enum FilterFriendStatusEnum {
    list    = 'list',
    request = 'request',
    invite  = 'invite'
}

export interface FilterGetAuthFriendRequest {
    username        ?: string;
    type            : FriendActivityStatusEnum;
    friend_status   : FilterFriendStatusEnum
}

export interface AuthFriendListResponse {
    id              : number;
    username        : string;
    avatar          : number;
    last_activity   ?: string;
    last_activity_at?: number;
    status          : FriendActivityStatusEnum;
    friend_status   : FriendStatusEnum;
}

export interface AuthFriendActionRequest {
    user_ids: Array<number>
}

export interface UserFriendSchema {
    user_id     : number;
    friended_id : number;
    status      : FriendStatusEnum;
}