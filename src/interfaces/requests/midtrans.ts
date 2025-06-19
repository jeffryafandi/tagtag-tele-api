export interface MidtransAccountValidationRequest {
    bank: string;
    account: string;
}

export interface MidtransCreatePayoutRequest {
    payouts: PayoutRequest[];
}

export interface MidtransApproveRequestRequest {
    reference_nos: string[];
}

interface PayoutRequest {
    beneficiary_name: string;
    beneficiary_account: string;
    beneficiary_bank: string;
    beneficiary_email?: string;
    amount: string;
    notes: string;
}

export interface MidtransCustomerTopupRequest {
    partnerReferenceNo: string;
    customerName: string;
    amount: CustomerTopupValueRequest;
    notes: string;
    additionalInfo: CustomerTopUpAdditionalInfoRequest;
}

export interface CustomerTopupValueRequest {
    value: string;
    currency: string;
}

export interface CustomerTopUpAdditionalInfoRequest {
    beneficiaryEmail: string;
    beneficiaryProvider: string;
    gopayAccountId: string;
}

