export interface LoginWithUsernamePasswordResponse {
    status      : number; 
    user_id     ?: number;
    username    ?: string;
    api_token   ?: string;
};

export interface LoginWithGoogleIdResponse {
    user_id     : number;
    username    : string;
    api_token   : string
};

export interface ActiveUserInventoryResponse {
    id          : number;
    code        ?: string;
    quantity    : number;
    value       : number;
    expired_at  : number;
}