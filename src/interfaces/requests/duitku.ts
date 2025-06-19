export interface DuitkuInquiryRequest {
    amount          : number;
    real_withdrawn  ?: number;
    bank_account    : string;
    bank_code       : string;
    purpose         : string; /** transaction reason */
    sender_name     : string;
    user_id         : number;
}

export interface DuitkuTransferRequest {
    disburse_id     : string; /** from inquiry API */
    amount          : number;
    bank_account    : string;
    bank_code       : string;
    account_name    : string; /** from inquiry API (accountName) */
    cust_ref_number : string; /** from inquiry API (custRefNumber) */
    purpose         : string; /** transaction reason */
}

export enum DuitkuProcessType {
    inquiry     = 'inquiry',
    transfer    = 'transfer'
}

export interface FilterUsersDuitkuLogs {
    start_date : string;
    end_date   : string;
}