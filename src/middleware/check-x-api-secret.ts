import middy, { MiddlewareFunction, HandlerLambda, NextFunction } from 'middy';
import lambda, { APIGatewayEvent, APIGatewayProxyResult, APIGatewayProxyEvent, Context, Handler } from 'aws-lambda';
import { HelperService } from '../services/helper';

export const checkXApiSecretMiddleware = () => {
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
        
        const helperService     = new HelperService();

        const apiSecret = handler.event.headers['X-API-Secret'] || handler.event.headers['X-Api-Secret'] || handler.event.headers['x-api-secret'] || handler.event.headers['X-API-SECRET'];
        console.log("X-Api-Secret:", apiSecret);   
        if (!apiSecret) throw Error('No API Secret found');

        const decodedToken = helperService.decodeToken(apiSecret)
        console.log(decodedToken)
        if(!decodedToken) throw Error('Cannot decode the token');

        let path = handler.event.path;
        const basePath = '/production';
        if (path.startsWith(basePath)) {
            path = path.substring(basePath.length);
        }
        const isValidToken = helperService.verifyToken(decodedToken, path, handler.event.body);
        if (!isValidToken) throw Error('Secret is invalid');

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
            console.log("Error check x api secret: ", message);
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
