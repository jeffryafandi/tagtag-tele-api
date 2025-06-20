import * as lambda from 'aws-lambda';
import { ResponseService } from '../../services/response';
import { AllResponse, authResponse, BaseResponse } from '../../interfaces/generals/response';
import { AuthService } from '../../services/auth';
import { Database } from '../../database';

const database = new Database();

export const auth: lambda.Handler = async (event: lambda.APIGatewayTokenAuthorizerEvent, context: lambda.Context, callback: lambda.Callback): Promise<authResponse> => {
    const connection            = await database.getConnection();
    const authService           = new AuthService(connection);

    const rawToken: string = event.authorizationToken;

    const token = authService.sanitizeRawToken(rawToken);

    const hookToken = process.env.HOOK_TOKEN;
    if(token != hookToken){
        return authService.generatePolicy(event.authorizationToken, 'Deny', event.methodArn);
    }

    return authService.generatePolicy(event.authorizationToken, 'Allow', event.methodArn);
}