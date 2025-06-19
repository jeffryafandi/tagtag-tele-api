export interface HttpResponse<T> extends Response {
    parsedBody  ?: T;
}

export interface BaseResponse {
    statusCode  : number,
    headers     : Record<string, string | number | boolean>
    body        ?: string
}

export interface AllResponse {
    body            ?: string,
    principalId     : string
    policyDocument  : Record<string, any>
}

export interface authResponse {
    principalId     : string,
    policyDocument  : Record<string, any>
}