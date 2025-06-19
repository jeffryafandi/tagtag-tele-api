export interface AwdPrepaidRequest {
    product_id      : string;
    msisdn          : string;
}

export interface AwdCheckBillRequest {
    product_id      : string;
    msisdn          : string;
}

export interface AwdPayBillRequest {
    product_id      : string;
    msisdn          : string;
    amount          : number;
}

export enum AwdProcessType {
    prepaid     = 'prepaid',
    pay         = 'pay'
}