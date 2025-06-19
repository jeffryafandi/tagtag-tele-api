import * as lambda from 'aws-lambda';
import { Database } from "../database";
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { InAppPurchaseService } from '../services/in-app-purchase';
import { AuthService } from '../services/auth';
import { Validator } from '../validators/base';
import { AppPurchaseRules, UpdatePurchasesRules, CreatePaymentRules } from '../validators/in-app-purchase';
import { InAppPurchaseSchema, InAppPurchaseCreatePayment, InAppPurchaseSchemaGopay } from '../entities/in-app-purchases';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';
import { MidtransService } from '../services/midtrans';
import { HelperService } from '../services/helper';
import { IN_APP_PURCHASE_STATUS } from '../config/constants';

export const getInAppProducts: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const inAppService      = new InAppPurchaseService(connection);
        const params            = event.queryStringParameters;
        const defaultGroupName  = 'free_ads';
        const data              = await inAppService.mapInAppProductsData({group_name: params?.group_name || defaultGroupName});

        return ResponseService.baseResponseJson(200, "Data fetched successfully", data);
    });
}

export const storeInAppPurchase: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection    = await new Database().getConnection();
    const inAppService  = new InAppPurchaseService(connection);
    const authService   = new AuthService(connection);

    let parsedBody: InAppPurchaseSchema;
    try {
        parsedBody = JSON.parse(`${event.body}`);
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }
        
    if (!parsedBody) return ResponseService.baseResponseJson(422, 'Body cannot be null', null);

    const validate = await new Validator(AppPurchaseRules).validate(parsedBody);
    if (!validate.status) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
    }

    const rawToken = event.headers.Authorization;
    const user = await authService.getUserFromToken(`${rawToken}`);
    if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

    const response = await inAppService.initiateAppPurchase(user, {...parsedBody, user_id: user.id});

    return ResponseService.baseResponseJson(response.statusCode, 'Request Processed successfully', {
        order_id: response.order_id,
        name: response.name,
        price: response.price,
        date: response.date,
        status: response.status
    })
}

export const updateInAppPurchase: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection    = await new Database().getConnection();
    const inAppService  = new InAppPurchaseService(connection);
    const authService   = new AuthService(connection);
    const rawToken      = event.headers.Authorization;
    const token         = event.pathParameters?.token || '';
    let parsedBody;

    try {
        parsedBody = JSON.parse(`${event.body}`);
        if (!parsedBody) throw Error;
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }

    const validate = await new Validator(UpdatePurchasesRules).validate(parsedBody);
    if (!validate.status) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
    }

    const user = await authService.getUserFromToken(`${rawToken}`);
    if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

    await inAppService.updatePurchaseByUser(user, {token, status: parsedBody.status})

    return ResponseService.baseResponseJson(200, 'Request Processed successfully', {})
}

export const createPayment: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection        = await new Database().getConnection();
    const inAppService      = new InAppPurchaseService(connection);
    const authService       = new AuthService(connection);
    const midtransService   = new MidtransService(connection);
    const helperService     = new HelperService();

    let parsedBody: InAppPurchaseCreatePayment;
    try {
        parsedBody = JSON.parse(`${event.body}`);
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }
        
    if (!parsedBody) return ResponseService.baseResponseJson(422, 'Body cannot be null', null);

    const validate = await new Validator(CreatePaymentRules).validate(parsedBody);
    if (!validate.status) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
    }

    const rawToken = event.headers.Authorization;
    if (!rawToken) {
        return ResponseService.baseResponseJson(401, 'Authorization header is required', {});
    }

    const user = await authService.getUserFromToken(`${rawToken}`);
    if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

    const product = await inAppService.getInAppProductByExtId(parsedBody.ext_product_id);
    if (!product) return ResponseService.baseResponseJson(422, 'Product is not found', {});

    // call midtrans access token
    const midtransAccessToken  = await midtransService.midtransAccessToken();
    if (!midtransAccessToken.success) {
        return ResponseService.baseResponseJson(422, 'Midtrans Access Token is failed', { error: true });
    }

    if(!midtransAccessToken.data.accessToken){
        return ResponseService.baseResponseJson(422, 'Midtrans Access Token is not found', {});
    }

    // call midtrans direct debit
    const orderId = helperService.generateRandomNumber(10).toString();
    const midtransDirectDebit = await midtransService.midtransDirectDebit(user, product, midtransAccessToken.data.accessToken, orderId);
    if (!midtransDirectDebit.success) {
        return ResponseService.baseResponseJson(422, 'Midtrans Direct Debit is failed', { error: true });
    }

    let purchaseSchema: InAppPurchaseSchemaGopay = {
        user_id: user.id,
        ext_product_id: product.ext_product_id,
        ext_token: midtransDirectDebit.data.referenceNo,
        status: IN_APP_PURCHASE_STATUS.PENDING,
        price: product.price,
        order_id: orderId,
        type: 'gopay'
    };

    await inAppService.savePurchase(purchaseSchema);

    return ResponseService.baseResponseJson(200, 'Request Processed successfully', {
        referenceNo: midtransDirectDebit.data.referenceNo,
        webRedirectUrl: midtransDirectDebit.data.webRedirectUrl
    });
}

// exports.storeInAppPurchase  = new MiddlewareWrapper().init(storeInAppPurchase, [checkBannedMiddleware()]);
// exports.updateInAppPurchase = new MiddlewareWrapper().init(updateInAppPurchase, [checkBannedMiddleware()]);
// exports.getInAppProducts    = new MiddlewareWrapper().init(getInAppProducts, [checkBannedMiddleware()]);
