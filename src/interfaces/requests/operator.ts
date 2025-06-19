export type FetchOperatorFilterRequest = {
    vendor      ?: string;
    group_name  ?: string;
}

export type CheckBillingRequest = {
    operator_id     : number;
    account_number  : string;
}

export type StoreUserOperatorPurchaseRequest = {
    account_number  : string;
    status          : OperatorStatusEnum;
    trx_id          : string;
}

export enum OperatorStatusEnum {
    SUCCESS = 'success',
    PENDING = 'pending',
    FAILED  = 'failed',
    REFUND  = 'refunded'
}