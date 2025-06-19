import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { RevenueService } from '../services/revenue';
import { Validator } from '../validators/base';
import { InitRevenueBaselineRules } from '../validators/revenue';
import { CreateRevenueBaselineRequest } from '../interfaces/requests/revenue';

export const addRevenueBaseline: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const revenueService    = new RevenueService(connection);
        if (!event.body) throw Error('Payload cannot be empty');
        
        const parsedBody        = JSON.parse(`${event.body}`) as CreateRevenueBaselineRequest;
        const validate          = await new Validator(InitRevenueBaselineRules).validate(parsedBody);

        // if (parsedBody.end_date <= parsedBody.start_date) {
        //     validate.status     = false;
        //     validate.message    = 'end_date is higher than the start_date'
        // }

        if (!validate.status) {
            return ResponseService.baseResponseJson(422, 'Payload is incorrect', {messages: validate.message});
        }

        await revenueService.initiateRevenueBaseline(parsedBody);
        return ResponseService.baseResponseJson(200, 'Baseline Added successfully', {});
    } catch (error: any) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something wrong with getBenefits', {error: error.message});
    }
}

export const publishRevenueBaseline: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection        = await new Database().getConnection();
        const revenueService    = new RevenueService(connection);
        const published         = await revenueService.publishBaseline();
 
        if (!published) throw Error('No baseline to publish!');

        return ResponseService.baseResponseJson(200, 'Baseline Published', {});
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something wrong with getBenefits', {error: error.message});
    }
}