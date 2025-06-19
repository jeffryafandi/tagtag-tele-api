import * as lambda from 'aws-lambda';

import { Database } from "../database";
import { HelperService } from "../services/helper";
import { PartnerService } from "../services/partner";
import { ResponseService } from '../services/response';
import { Validator } from '../validators/base';
import { CreatePartnerAdRules, CreatePartnerRules, GetPartnerAdRules } from '../validators/partner';
import { AdsLogType } from '../validators/ads-log';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { MiddlewareWrapper } from '../middleware';

const init = async () => {
    const connection    = await new Database().getConnection();
    const helperService = new HelperService();
    const partnerService= new PartnerService(connection); 

    return {connection, helperService, partnerService}
}

export const getRandomPartnerAd: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { partnerService }= await init();
        let type: AdsLogType    = AdsLogType.interstitial;

        if (event.queryStringParameters) {
            const validate = await new Validator(GetPartnerAdRules).validate(event.queryStringParameters);
            if (!validate.status) {
                return ResponseService.baseResponseJson(422, 'Parameter is incorrect', {messages: validate.message});
            }
            type = event.queryStringParameters.type as AdsLogType;
        };
        const partnerAd = await partnerService.fetchRandomPartnerAdByType(type);
        if (!partnerAd) throw Error('No partner ad exist at this time');

        return ResponseService.baseResponseJson(200, 'Partner Ad is fetched successfully', partnerAd);
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

// exports.getRandomPartnerAd = new MiddlewareWrapper().init(getRandomPartnerAd, []);
