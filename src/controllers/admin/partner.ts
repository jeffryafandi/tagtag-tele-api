import * as lambda from 'aws-lambda';

import { Database } from "../../database";
import { HelperService } from "../../services/helper";
import { PartnerService } from "../../services/partner";
import { ResponseService } from '../../services/response';
import { Validator } from '../../validators/base';
import { CreatePartnerAdRules, CreatePartnerRules } from '../../validators/partner';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';

const init = async () => {
    const connection    = await new Database().getConnection();
    const helperService = new HelperService();
    const partnerService= new PartnerService(connection); 

    return {connection, helperService, partnerService}
}

export const addNewpartner: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { partnerService } = await init();
        if (!event.body) throw Error("Body payload cannot be null");

        const payload = JSON.parse(event.body);
        const validate = await new Validator(CreatePartnerRules).validate(payload);
        
        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const partner = await partnerService.fetchPartnerByName(payload.name);
        if (partner) throw Error("Partner with this name is exist");

        const newPartner = await partnerService.store(payload);
        return ResponseService.baseResponseJson(200, 'Partner is created successfully', newPartner);
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

export const addNewAdForPartner: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const { partnerService } = await init();
        if (!event.body) throw Error("Body payload cannot be null");

        const payload   = JSON.parse(event.body);
        const validate    = await new Validator(CreatePartnerAdRules).validate(payload);
        if (payload.duration && payload.min_watch_time) {
            if (payload.min_watch_time > payload.duration) {
                validate.status     = false;
                validate.message    = 'min_watch_time should not be higher than duration';
            }
        }

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        const partner = await partnerService.fetchPartnerById(payload.partner_id);
        if (!partner) throw Error("Partner is not found");

        const newPartner = await partnerService.storeAdForPartner(payload);
        return ResponseService.baseResponseJson(200, 'Partner is created successfully', newPartner);
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}

// exports.addNewpartner            = new AdminMiddlewareWrapper().init(addNewpartner, [adminCheckWhitelistIp()]);
// exports.addNewAdForPartner       = new AdminMiddlewareWrapper().init(addNewAdForPartner, [adminCheckWhitelistIp()]);