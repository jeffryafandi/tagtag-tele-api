export enum MidtransResponseCode {
    success = '200',
    pending = '201',
    denied = '202',
    validationError = '400',
    accessDenied = '401',
    merchantNoAccess = '402',
    contentNotAcceptable = '403',
    notFound = '404',
    methodNotAllowed = '405',
    duplicateOrderID = '406',
    expiredTransaction = '407',
    wrongDataType = '408',
    merchantDeactivated = '410',
    invalidToken = '411',
    merchantCannotModifyStatus = '412',
    malformedSyntax = '413',
    InternalServerError = '500',
    featureIsNotAvailable = '501',
    InternalServerError2 = '502',
    InternalServerError3 = '503',
    InternalServerError4 = '504'
}

export type MidtransAccountValidationResponse = {
    id: string;
    account_name: string;
    account_no: string;
    bank_name: string;
}

export type MidtransCreatePayoutResponse = {
    payouts: PayoutResponse[];
    status_code: MidtransResponseCode;
}

export type MidtransApprovePayoutResponse = {
    reference_nos: string[];
    otp: string;
    error_message: string;
    errors: string[];
}

export type MiniAppTokenResponse = {
    success: boolean;
    data: TokenResponse;
    error: any
}

export type MidtransAccessTokenResponse = {
    responseCode: string;
    responseMessage: string;
    accessToken: string;
    tokenType: string;
    expiresIn: string;
    referenceNo: string;
}

export interface MidtransDirectDebitResponse {
    responseCode: string;
    responseMessage: string;
    referenceNo: string;
    partnerReferenceNo: string;
    webRedirectUrl: string;
    appRedirectUrl: string;
    additionalInfo: {
        paymentType: string;
        grossAmount: {
            value: string;
            currency: string;
        };
        transactionTime: string;
        validUpTo: string;
    };
}

interface TokenResponse {
    auth_token: string;
    gopay_account_id: string;
}

interface PayoutResponse {
    status: string;
    reference_no: string;
}

export interface MidtransCustomerTopupResponse {
    responseCode: string;
    responseMessage: string;
    referenceNo: string;
    partnerReferenceNo: string;
    additionalInfo: {
        beneficiaryProvider: string;
        gopayAccountId: string;
    }
}