import * as lambda from 'aws-lambda';
import { Database } from '../../database';
import { AuthService } from '../../services/auth';
import { DailyLoginService } from '../../services/daily-login';
import { UserService } from '../../services/user';
import { ResponseService } from '../../services/response';
import { BaseResponse } from '../../interfaces/generals/response';
import { LuckyWheelsService } from '../../services/lucky-wheels';
import { HelperService } from '../../services/helper';
import { Validator } from '../../validators/base';
import { CreateLuckyWheel, UpdateLuckyWheel } from '../../validators/lucky-wheel';
import dayjs from 'dayjs';
import { SUBTRACT_DAY } from '../../config/constants';
import { AdminMiddlewareWrapper } from '../../middleware/index-admin';
import { adminCheckWhitelistIp } from '../../middleware/admin-check-whitelist-ip';



export const luckyWheelList: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const helperService         = new HelperService();   
    const luckyWheelsService    = new LuckyWheelsService(connection);   
    
    let filters = event.queryStringParameters;

    let [mappedList, total] = await luckyWheelsService.getLuckyWheelList(filters);
    return ResponseService.baseResponseJson(200, 'Request processed successfully', mappedList, helperService.generatePagination(event, total));
}

export const luckyWheelDetail: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    const luckyWheelId          = event.pathParameters?.luckyWheelId;
    if (!luckyWheelId || isNaN(Number(luckyWheelId))) throw Error('Invalid value for lucky wheel id parameter');

      let luckyWheel = await luckyWheelsService.getLuckyWheelByIdMapped(Number(luckyWheelId));

      if(luckyWheel == undefined){
          return ResponseService.baseResponseJson(404, 'Lucky Wheel not found', null);
      }

      return ResponseService.baseResponseJson(200, 'Successfully', luckyWheel);
}

export const createLuckyWheel: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const luckyWheelsService    = new LuckyWheelsService(connection);

    let body = event.body;
    if(body == null){
        return ResponseService.baseResponseJson(422, 'Payload must be filled', null);
    }

    let parsedBody: any;
    try {
        parsedBody = JSON.parse(body);
    } catch (error) {
        console.error(error);
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }
    
    // Validate Payload
    let validator = new Validator(CreateLuckyWheel);

    let validate = await validator.validate(parsedBody);
    if(validate.status == false){
        return ResponseService.baseResponseJson(422, validate.message, null);
    }

    let luckyWheel = await luckyWheelsService.createLuckyWheel(parsedBody);

    if(luckyWheel == undefined){
        return ResponseService.baseResponseJson(422, 'Create luckyWheel failed. Please check logs.', null);
    }


    return ResponseService.baseResponseJson(200, 'successfully', luckyWheel );
}

export const updateLuckyWheel: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    const luckyWheelId          = event.pathParameters?.luckyWheelId;
    if (!luckyWheelId || isNaN(Number(luckyWheelId))) throw Error('Invalid value for lucky wheel id parameter');

    let body = event.body;
    if(body == null){
        return ResponseService.baseResponseJson(422, 'Payload must be filled', null);
    }

    let parsedBody: any;
    try {
        parsedBody = JSON.parse(body);
    } catch (error) {
        console.error(error);
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }
    
    let luckyWheel = await luckyWheelsService.getLuckyWheelById(Number(luckyWheelId));
    
    if(luckyWheel == undefined){
        return ResponseService.baseResponseJson(404, 'Lucky Wheel not found', null);
    }

    let luckyWheelUpdate = await luckyWheelsService.updateLuckyWheelById(luckyWheel.id, parsedBody);

    if(luckyWheelUpdate == undefined){
        return ResponseService.baseResponseJson(422, 'Create luckyWheel failed. Please check logs.', null);
    }


    return ResponseService.baseResponseJson(200, 'successfully', luckyWheelUpdate );
}


export const deleteLuckyWheel: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    const luckyWheelId          = event.pathParameters?.luckyWheelId;
    if (!luckyWheelId || isNaN(Number(luckyWheelId))) throw Error('Invalid value for lucky wheel id parameter');
    
    let luckyWheel = await luckyWheelsService.getLuckyWheelById(Number(luckyWheelId));
    
    if(luckyWheel == undefined){
        return ResponseService.baseResponseJson(404, 'Lucky Wheel not found', null);
    }
    
    let luckyWheelDelete = await luckyWheelsService.deleteLuckyWheelById(luckyWheel.id);
    
    if(luckyWheelDelete == undefined){
        return ResponseService.baseResponseJson(422, 'Create luckyWheel failed. Please check logs.', null);
    }
    
    
    return ResponseService.baseResponseJson(200, 'successfully', luckyWheelDelete );
}


export const createLuckyWheelPrizes: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    const luckyWheelId          = event.pathParameters?.luckyWheelId;
    if (!luckyWheelId || isNaN(Number(luckyWheelId))) throw Error('Invalid value for lucky wheel id parameter');

    let body = event.body;
    if(body == null){
        return ResponseService.baseResponseJson(422, 'Payload must be filled', null);
    }

    let parsedBody: any;
    try {
        parsedBody = JSON.parse(body);
    } catch (error) {
        console.error(error);
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }
    
    let luckyWheel = await luckyWheelsService.getLuckyWheelById(Number(luckyWheelId));
    
    if(luckyWheel == undefined){
        return ResponseService.baseResponseJson(404, 'Lucky Wheel not found', null);
    }

    let luckyWheelUpdate = await luckyWheelsService.createLuckyWheelPrize({
        luckyWheel                    : luckyWheel,
        coupon_prize                  : parsedBody.coupon_prize,
        coin_prize                    : parsedBody.coin_prize,
        game_inventory_id             : parsedBody.game_inventory_id,
        lucky_wheel_spin_entry_prize  : parsedBody.lucky_wheel_spin_entry_prize,
        activity_point_prize          : parsedBody.activity_point_prize,

    });

    if(luckyWheelUpdate == undefined){
        return ResponseService.baseResponseJson(422, 'Create luckyWheel failed. Please check logs.', null);
    }


    return ResponseService.baseResponseJson(200, 'successfully', luckyWheelUpdate );
}

export const updateLuckyWheelPrizes: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    const luckyWheelPrizeId          = event.pathParameters?.luckyWheelPrizeId;
    if (!luckyWheelPrizeId || isNaN(Number(luckyWheelPrizeId))) throw Error('Invalid value for lucky wheel id parameter');

    let body = event.body;
    if(body == null){
        return ResponseService.baseResponseJson(422, 'Payload must be filled', null);
    }

    let parsedBody: any;
    try {
        parsedBody = JSON.parse(body);
    } catch (error) {
        console.error(error);
        return ResponseService.baseResponseJson(422, 'Payload is incorrect. Please check logs', null);
    }
    
    let luckyWheelPrizes = await luckyWheelsService.getLuckyWheelPrizesById(Number(luckyWheelPrizeId));
    
    if(luckyWheelPrizes == undefined){
        return ResponseService.baseResponseJson(404, 'Lucky Wheel not found', null);
    }

    let luckyWheelUpdate = await luckyWheelsService.updateLuckyWheelPrizesById(luckyWheelPrizes.id, parsedBody);

    if(luckyWheelUpdate == undefined){
        return ResponseService.baseResponseJson(422, 'Update luckyWheel Prize failed. Please check logs.', null);
    }


    return ResponseService.baseResponseJson(200, 'successfully', luckyWheelUpdate );
}

export const deleteLuckyWheelPrizes: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection            = await new Database().getConnection();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    const luckyWheelPrizeId          = event.pathParameters?.luckyWheelPrizeId;
    if (!luckyWheelPrizeId || isNaN(Number(luckyWheelPrizeId))) throw Error('Invalid value for lucky wheel id parameter');
    
    let luckyWheelPrizes = await luckyWheelsService.getLuckyWheelPrizesById(Number(luckyWheelPrizeId));
    
    if(luckyWheelPrizes == undefined){
        return ResponseService.baseResponseJson(404, 'Lucky Wheel Pizes not found', null);
    }
    
    let luckyWheelDelete = await luckyWheelsService.deleteLuckyWheelPrizesById(luckyWheelPrizes.id);
    
    if(luckyWheelDelete == undefined){ 
        return ResponseService.baseResponseJson(422, 'Delete luckyWheel Prizes failed. Please check logs.', null);
    }
    
    
    return ResponseService.baseResponseJson(200, 'successfully', luckyWheelDelete );
}

export const getLuckyWheelAnalytic: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection      = await new Database().getConnection();
    const helperService   = new HelperService();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    const getLuckyWheelAnalytic = await luckyWheelsService.getLuckyWheelAnalytic()


    return ResponseService.baseResponseJson(200, 'Success', getLuckyWheelAnalytic)
}

export const getLuckyWheelLog: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const connection      = await new Database().getConnection();
    const helperService   = new HelperService();
    const luckyWheelsService    = new LuckyWheelsService(connection);
    let startDate         = event.queryStringParameters?.startDate;
    let endDate           = event.queryStringParameters?.endDate;
    let luckyWheelId      = event.queryStringParameters?.luckyWheelId;
    let filters           = event.queryStringParameters;

    if (!endDate) {
        endDate = dayjs().format('YYYY-MM-DD');
    }
    if (!startDate) {
       startDate =  dayjs(helperService.substractDays(`${endDate}T00:00:00`, SUBTRACT_DAY)).format('YYYY-MM-DD');
    }
     console.log(startDate)
     console.log(endDate)

    let [mapped, total] = await luckyWheelsService.userLuckyWheelLog(filters, startDate, endDate)


    return ResponseService.baseResponseJson(200, 'Success', mapped, helperService.generatePagination(event, total))
}

// exports.luckyWheelList            = new AdminMiddlewareWrapper().init(luckyWheelList, [adminCheckWhitelistIp()]);
// exports.luckyWheelDetail          = new AdminMiddlewareWrapper().init(luckyWheelDetail, [adminCheckWhitelistIp()]);
// exports.createLuckyWheel          = new AdminMiddlewareWrapper().init(createLuckyWheel, [adminCheckWhitelistIp()]);
// exports.updateLuckyWheel          = new AdminMiddlewareWrapper().init(updateLuckyWheel, [adminCheckWhitelistIp()]);
// exports.deleteLuckyWheel          = new AdminMiddlewareWrapper().init(deleteLuckyWheel, [adminCheckWhitelistIp()]);
// exports.createLuckyWheelPrizes    = new AdminMiddlewareWrapper().init(createLuckyWheelPrizes, [adminCheckWhitelistIp()]);
// exports.updateLuckyWheelPrizes    = new AdminMiddlewareWrapper().init(updateLuckyWheelPrizes, [adminCheckWhitelistIp()]);
// exports.deleteLuckyWheelPrizes    = new AdminMiddlewareWrapper().init(deleteLuckyWheelPrizes, [adminCheckWhitelistIp()]);
// exports.getLuckyWheelAnalytic     = new AdminMiddlewareWrapper().init(getLuckyWheelAnalytic, [adminCheckWhitelistIp()]);
// exports.getLuckyWheelLog          = new AdminMiddlewareWrapper().init(getLuckyWheelLog, [adminCheckWhitelistIp()]);