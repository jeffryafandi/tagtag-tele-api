import middy, { MiddlewareFunction, HandlerLambda, NextFunction } from 'middy';
import lambda, { APIGatewayEvent, APIGatewayProxyResult, APIGatewayProxyEvent, Context, Handler } from 'aws-lambda';
import { UserService } from '../services/user';
import { Database } from '../database';

export const checkForceUpdateMiddleware = () => {
    const before: MiddlewareFunction<APIGatewayProxyEvent, APIGatewayProxyResult, Context> = async (
        handler: HandlerLambda<APIGatewayEvent, APIGatewayProxyResult>,
        next: NextFunction
    ) => {
        const apiPath   = handler.event.pathParameters;

        if (apiPath && apiPath.action) {
            if (apiPath.action == 'claim-completion'){
                return next();
            }
        }
        
        const conn            = await new Database().getConnection();
        const userService     = new UserService(conn);

        const appVersion = handler.event.headers['app_version_code'] || handler.event.headers['X-App-Version-Code'] || handler.event.headers['x-app-version-code'] || handler.event.headers['X-APP-VERSION-CODE'] || '0';
        const devicePlatform = handler.event.headers['X-Device-Platform'] || handler.event.headers['x-device-platform'] || handler.event.headers['X-DEVICE-PLATFORM']
        console.log("X-App-Version-Code:", appVersion);  
        console.log("X-Device-Platform:", devicePlatform);  

        if (devicePlatform == "web") return;

        const isUpdate = await userService.checkForUpdate(appVersion);

        if(isUpdate) {
            throw new Error(JSON.stringify({
                message     : 'Versi baru tersedia. Silahkan unduh dari PlayStore',
                name        : 'Bad Request',
                data        : {
                    code    : 7,
                    message : 'UPGRADE_NEEDED'
                },
                statusCode  : 400
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
            console.log("Error check force update: ", message);
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