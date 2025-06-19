import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { BankService } from '../services/bank';
import { CheckBankAccountRequest } from '../interfaces/requests/bank';
import { HelperService } from '../services/helper';

export const getListOfBanks: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const bankService   = new BankService(connection);
        const data          = await bankService.mapBankData();

        return ResponseService.baseResponseJson(200, "Data fetched successfully", data);
    });
}

export const checkBankAccount: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const bankService   = new BankService(connection);
        if (!event.body) throw Error('Payload cannot be null')

        const parsedBody: CheckBankAccountRequest = JSON.parse(event.body);
        const data  = await bankService.checkBankAccountFromDuitku(parsedBody);
        return ResponseService.baseResponseJson(200, "Data fetched successfully", data);
    } catch (error: any) {
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)})
    }
}