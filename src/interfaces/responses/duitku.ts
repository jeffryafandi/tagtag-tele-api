export enum DuitkuResponseCodes {
    success             = '00',
    generalError        = 'EE',
    requestTimeout      = 'TO',
    linkTrouble         = 'LD',
    notListed           = 'NF',
    invalidDestination  = '76',
    waitingCallback     = '80',
    otherError          = '-100',
    userNotFound        = '-120',
    userBlocked         = '-123',
    invalidNominal      = '-141',
    pastTransaction     = '-142',
    h2hNotSupported     = '-148',
    bankNotRegistered   = '-149',
    callbackNotFound    = '-161',
    invalidSignature    = '-191',
    accountBlacklisted  = '-192',
    wrongEmail          = '-213',
    transactionNotFound = '-420',
    insufficientBalance = '-510',
    limitOverdue        = '-920',
    unregisteredIP      = '-930',
    timeRanOut          = '-951',
    invalidParameter    = '-952',
    invalidTimestamp    = '-960'
}

export type DuitkuPossibleTransferResponse = {
    responseCode    : DuitkuResponseCodes,
    responseDesc    : string,
    bankCode        : string,
    bankAccount     : string,
    accountName     : string,
    amountTransfer  ?: number,
    disburseId      : string
}