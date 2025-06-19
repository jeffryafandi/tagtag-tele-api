import { MiddlewareFunction, HandlerLambda, NextFunction } from 'middy';
import { APIGatewayEvent, APIGatewayProxyResult, APIGatewayProxyEvent, Context, Handler } from 'aws-lambda';
import { Database } from '../database';
import { AppConfigService } from '../services/app-config';
import { APP_CONFIG_KEY } from '../config/app-config-constant';
import { getClientIp } from 'request-ip';

export const adminCheckWhitelistIp = () => {
    const before: MiddlewareFunction<APIGatewayProxyEvent, APIGatewayProxyResult, Context> = async (
        handler: HandlerLambda<APIGatewayEvent, APIGatewayProxyResult>,
        next: NextFunction
    ) => {
        const conn                  = await new Database().getConnection();
        const appConfigService      = new AppConfigService(conn);
        const clientIp              = handler.event.headers ? (handler.event.headers['X-Forwarded-For'] || getClientIp(handler.event) || 'N/A') : "N/A";

        const adminWhitelistIpsConfig= await appConfigService.getConfigByKey(APP_CONFIG_KEY.adminWhitelistIPs);
        if(adminWhitelistIpsConfig) {
            const allowedAdminIPS        = JSON.parse(adminWhitelistIpsConfig.config_value);
            //sementara kalo ga ada ip sama sekali di bolehin dulu, karna gatau dapet ip server si retools nya apa ga
            if(allowedAdminIPS.length == 0) return;
            
            if (allowedAdminIPS.includes(clientIp)) return;

            throw new Error(JSON.stringify({
                statusCode  : 403,
                data        : {
                    code    : 1,
                    message : 'Forbidden!'
                },
                message     : 'User is not authorized to access this resource'
            }));
        }

        return;
    }

    const after = async (request: any) => {
        // you can transform here
        // console.log("TRIGGER AFTER", request);
    }

    const onError = async (request: any) => {
        let message = request.error.message;
        try {
            message = JSON.parse(message);
        } catch (error) {
            message = message;
        }

        if (typeof message == 'string') {
            console.log("Error App Maintenance Error: ", message);
            request.response = {
                statusCode: 500,
                body: JSON.stringify({
                    message: 'Server error in the middleware side'
                })
            };
        }
        else {
            request.response = {
                statusCode: message.statusCode || 401,
                body: JSON.stringify({
                    status: message.statusCode,
                    message: message.message,
                    data: message.data
                }),
            };
        }
    }

    return {
        before,
        after,
        onError
    }
}