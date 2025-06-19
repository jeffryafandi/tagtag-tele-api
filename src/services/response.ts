import { Pagination } from "../interfaces/generals/pagination";
import { BaseResponse } from "../interfaces/generals/response";

export class ResponseService {

    static baseResponseJson(statusCode: number, message: string, payload: any, pagination?: Pagination): BaseResponse {
        const response = {
            statusCode  : statusCode,
            headers     : {
                "Access-Control-Allow-Origin"       : '*',
                "Access-Control-Allow-Credentials"  : true,
                'Access-Control-Expose-Headers'     : '*',
                "Access-Control-Allow-Headers"      : "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,Cache-Control,X-Device-Platform,x-device-platform,X-DEVICE-PLATFORM,X-App-Version-Code,x-app-version-code,X-APP-VERSION-CODE,X-API-Secret,x-api-secret,X-API-SECRET,X-Api-Secret",
                "Total"                             : 1,
                "Page-No"                           : 1,
                "Page-Length"                       : 1
            },
            body : JSON.stringify({
                'status'    : statusCode,
                'message'   : message,
                'data'      : payload
            })
            
        };
    
        if (pagination) {
            response.headers = {
                ...response.headers,
                "Total"         : pagination.Total,
                "Page-No"       : pagination.PageNo,
                "Page-Length"   : pagination.PageLength
            };
        }
    
        return response;
    }
}