import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { AffiliateBenefitService } from '../services/affiliate-benefit';
import { ResponseService } from '../services/response';
import { GetBenefitQueryRules, RejectAffiliateStatusRules, UpdateAffiliateStatusRules, UpgradeAffiliateRequestRules } from '../validators/affiliate';
import { Validator } from '../validators/base';
import { AffiliateService } from '../services/affiliate';
import { AuthService } from '../services/auth';
import { UserService } from '../services/user';
import { isNumber } from 'underscore';
import { AFFILIATE_BENEFIT_ID } from '../config/constants';
import { HelperService } from '../services/helper';
import { UpdateStatusAffiliateRequest } from '../interfaces/requests/users';

export const getBenefits: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const benefitService    = new AffiliateBenefitService(connection);
            let filter              = {};
    
            if (event.queryStringParameters) {
                const validate = await new Validator(GetBenefitQueryRules).validate(event.queryStringParameters);
                if (!validate.status) {
                    return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
                }
                const {type, commission_type} = event.queryStringParameters;
                filter = {
                    type,
                    commission_type
                };
            };
    
            const benefits      = await benefitService.getBenefitList(filter);
            const mapBenefit    = benefitService.mapBenefitResponse(benefits);
    
            return ResponseService.baseResponseJson(200, 'Data fetched successfully', mapBenefit);
        } catch (error) {
            console.log(error);
            return ResponseService.baseResponseJson(422, 'Something wrong with getBenefits', {error: JSON.stringify(error)});
        }
    });
}

export const affiliateUpgradeRequest: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection        = await new Database().getConnection();
    const affiliateService  = new AffiliateService(connection);
    const authService       = new AuthService(connection);
    const userService       = new UserService(connection);
    const helperService     = new HelperService();

    const body = event.body;
    if(body == null){
        return ResponseService.baseResponseJson(422, 'Payload must be filled', null);
    }

    let parsedBody: any;
    try {
        parsedBody = JSON.parse(body);
    } catch (error) {
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }
    // Validate Payload
    const validator   = new Validator(UpgradeAffiliateRequestRules);
    const validate    = await validator.validate(parsedBody);
    if(validate.status == false){
        return ResponseService.baseResponseJson(422, validate.message, null);
    }
    // End Validate Payload
    // Get Logged User
    let user        = undefined;
    const rawToken    = event.headers.Authorization;
    if (rawToken != undefined) {
        const token   = authService.sanitizeRawToken(rawToken);
        user        = await userService.getUserByApiToken(token);
    }
    if (user == null) {
        return ResponseService.baseResponseJson(401, 'Token is invalid.', null);
    }
    // Create affiliate if user not have a affiliate id
    let affiliate = await userService.getAffiliateUser(user)
    if (affiliate == null) {
        affiliate = await userService.addAuthAffiliate(user, {
            name                    : user.name,
            email                   : user.email,
            affiliate_benefit_id    : AFFILIATE_BENEFIT_ID,
        });
    }
    
    // End Get Logged User
    // reject if user have a pending request and request created at under 7 days
    const affiliateUpgrade = await userService.getAffiliateUpgradeRequestUserByAffiliateId(affiliate.id)
    if (affiliateUpgrade?.status == 'pending' || helperService.isOneWeek(affiliateUpgrade?.updated_at)) {
        return ResponseService.baseResponseJson(422, 'You stil have an ongoing upgrade request', null);
    }
    // End reject if user have a pending request and request created at under 7 days
    // Store new affiliate upgrade request
    const affiliateUpgradeRequest = await affiliateService.affiliateUpgradeRequest(affiliate,parsedBody);

    if (affiliateUpgradeRequest === undefined) {
        return ResponseService.baseResponseJson(422, 'Failed to Create request. Please check logs.', null);
    }
    // End Store affiliate upgrade request
    // Store affiliate upgrade request socials
    if (parsedBody.socials) {
        const socials = parsedBody.socials;
        for ( const social of socials) {
            const type = social.type;
            const link = social.link;
            const AffiliateSocialRequest = await affiliateService.AffiliateSocialRequest({
                affiliateUpgradeRequests : affiliateUpgradeRequest,
                type                     : type,
                link                     : link,
            });

            if(!AffiliateSocialRequest){
                return ResponseService.baseResponseJson(422, 'Something is wrong', null);;
            }       
        }
    }
    // End Store affiliate upgrade request socials
    
    return ResponseService.baseResponseJson(200, 'Request processed successfully', {});
}

export const updateAffiliateUpgradeStatus: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection            = await new Database().getConnection();
        const affiliateService      = await new AffiliateService(connection);
        const affiliateUpgradeId    = event.pathParameters?.affiliateUpgradeId;
        if (!affiliateUpgradeId || isNaN(Number(affiliateUpgradeId))) throw Error('Invalid value for affiliate_upgrade_id parameter');
        if (!event.body) throw Error('Body cannot be empty');
        
        const parsedBody: UpdateStatusAffiliateRequest = JSON.parse(event.body);

        const validate = await new Validator(UpdateAffiliateStatusRules).validate(parsedBody);
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const approved = await affiliateService.updateAffiliateUpgradeStatus(Number(affiliateUpgradeId), parsedBody);

        return ResponseService.baseResponseJson(200, 'Affiliate Upgrade status is updated',{status : parsedBody.status});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const upgradeRequestApproved: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback) => {
    const query = event.queryStringParameters;
    const content = `<script>window.location.replace("tagtag://tagtag/deeplink/upgrade_level?prev=${query?.prev}&current=${query?.current}&percent=${query?.percent}")</script>`;
    let response = {
        statusCode: 200,
        headers: {
        "Content-Type": "text/html",
        },
        body: content,
    };

    if (!query?.prev || !query?.current || !query?.percent) {
        response = {
            statusCode: 404,
            headers: {
            "Content-Type": "text/html",
            },
            body: 'Not Found!',
        };
    }

    // callback will send HTML back
    callback(null, response);
}