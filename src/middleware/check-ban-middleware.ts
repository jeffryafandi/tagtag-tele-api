import middy, { MiddlewareFunction, HandlerLambda, NextFunction } from 'middy';
import { httpErrorHandler } from 'middy/middlewares';
import lambda, { APIGatewayEvent, APIGatewayProxyResult, APIGatewayProxyEvent, Context, Handler } from 'aws-lambda';
import { Database } from '../database';
import { AuthService } from '../services/auth';
import { ResponseService } from '../services/response';
import dayjs from 'dayjs';
import { HelperService } from '../services/helper';
import { AppConfigService } from '../services/app-config';
import { APP_CONFIG_KEY } from '../config/app-config-constant';
import { getClientIp } from 'request-ip';

export const checkBannedMiddleware = () => {
    const before: MiddlewareFunction<APIGatewayProxyEvent, APIGatewayProxyResult, Context> = async (
        handler: HandlerLambda<APIGatewayEvent, APIGatewayProxyResult>,
        next: NextFunction
    ) => {
        const conn              = await new Database().getConnection();
        const authService       = new AuthService(conn);
        const helperService     = new HelperService();
        const appConfigService  = new AppConfigService(conn);
        // const clientIp              = getClientIp(handler.event) || 'N/A';
        const clientIp = handler.event.headers ? (handler.event.headers['X-Forwarded-For'] || getClientIp(handler.event) || 'N/A') : "N/A";

        const berarerToken  = handler.event.headers['Authorization'];
        if (!berarerToken) throw Error('Error');
        const token = berarerToken.split(' ');
        if (token.length > 1 && token[1] === process.env.HOOK_TOKEN) return next();
        const user  = await authService.getUserFromToken(berarerToken);
        if (!user) {
            throw new Error(JSON.stringify({
                statusCode  : 403,
                data        : {
                    code    : 1,
                    message : 'Forbidden!'
                },
                message     : 'User is not authorized to access this resource'
            }));
        } else {
            console.log("USER BANS", user.bans);
            if (user.bans.length > 0) {
                const expiredAt = user.bans.map((ban) => {
                    if (!ban.expired_in) return 0;
                    const created = helperService.toDateTime(dayjs(ban.created_at));
                    const expired = dayjs(helperService.addHours(created, ban.expired_in)).valueOf();
                    return expired;
                });

                expiredAt.sort((a, b) => b - a);
                const hasPermanent = expiredAt.findIndex((time) => time == 0);

                let errorData: any = {
                    message     : 'Whoops! It looks like someone doing something bad :D',
                    name        : 'Unauthorized!',
                    data        : {
                        code    : 99,
                        message : 'banned'
                    },
                    statusCode  : 401
                };

                if (hasPermanent < 0) {
                    errorData.data = {...errorData.data, expired_at: expiredAt[0]}
                }

                throw new Error(JSON.stringify(errorData));
            }

            const blockedIPsConfig  = await appConfigService.getConfigByKey(APP_CONFIG_KEY.blockedIPs);

            if (blockedIPsConfig) {
                const blockedIPS    = JSON.parse(blockedIPsConfig.config_value);
                if (blockedIPS.includes(clientIp)){
                    let errorData: any = {
                        message     : 'Whoops! It looks like someone doing something bad :D',
                        name        : 'Unauthorized!',
                        data        : {
                            code    : 99,
                            message : 'banned'
                        },
                        statusCode  : 401
                    };

                    throw new Error(JSON.stringify(errorData));
                }
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

        if (typeof message == 'string') {
            console.log("Error check ban user: ", message);
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
