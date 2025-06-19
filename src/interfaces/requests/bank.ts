export type CheckBankAccountRequest = {
    bank_id         ?: number,
    operator_id     ?: number,
    bank_code       ?: string,
    account_number  : string
}