import { MiddlewareFunction, HandlerLambda, NextFunction } from 'middy';
import { APIGatewayEvent, APIGatewayProxyResult, APIGatewayProxyEvent, Context, Handler } from 'aws-lambda';
import { Database } from '../database';
import { ResponseService } from '../services/response';
import { AppConfigService } from '../services/app-config';
import { APP_CONFIG_KEY } from '../config/app-config-constant';
import { getClientIp } from 'request-ip';


export const checkAppMaintenance = () => {
    const before: MiddlewareFunction<APIGatewayProxyEvent, APIGatewayProxyResult, Context> = async (
        handler: HandlerLambda<APIGatewayEvent, APIGatewayProxyResult>,
        next: NextFunction
    ) => {
        const conn                  = await new Database().getConnection();
        const appConfigService      = new AppConfigService(conn);
        // const clientIp              = getClientIp(handler.event) || 'N/A';
        const clientIp = handler.event.headers ? (handler.event.headers['X-Forwarded-For'] || getClientIp(handler.event) || 'N/A') : "N/A";

        const appMaintenanceConfig  = await appConfigService.getConfigByKey(APP_CONFIG_KEY.appMaintenance);
        if (appMaintenanceConfig) {
            const isMaintenance = Number(appMaintenanceConfig.config_value);
            if (isMaintenance) {
                const whitelistIPsConfig    = await appConfigService.getConfigByKey(APP_CONFIG_KEY.whitelistIPs);
                if (whitelistIPsConfig) {
                    const allowedIPS        = JSON.parse(whitelistIPsConfig.config_value);
                    if (allowedIPS.includes(clientIp)) return;
                }

                throw new Error(JSON.stringify({
                    message     : 'Hehe, looks who want to gain some money! Too bad, we are doing some maintenances!',
                    name        : 'Forbidden',
                    data        : {
                        code    : 3,
                        message : 'app_maintenance'
                    },
                    statusCode  : 403
                }));
            }
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
        console.log("FOUND ERROR HERE", request);
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
