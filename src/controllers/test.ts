import * as lambda from 'aws-lambda';

import { Database } from '../database';
import { ResponseService } from '../services/response';
import { AllResponse, authResponse, BaseResponse } from '../interfaces/generals/response';
import { DuitkuService } from '../services/duitku';
import { MidtransService } from '../services/midtrans';
import AWS from 'aws-sdk';
import { Banks } from '../entities/banks';
import { FirebaseService } from '../services/firebase';
import { RaffleService } from '../services/raffle';
import { AwdService } from '../services/awd';
import { RaffleTicketSchema } from '../interfaces/requests/raffle';
import { HelperService } from '../services/helper';
import { LambdaService } from '../services/aws/lambda';
import { SQSService } from '../services/aws/sqs';
import { handleNotificationMessagesQueueFromSNS, handleNotificationQueueFromSNS, handleQuestQueueFromSNS, handleRaffleTicketQueueFromSNS } from './queue';
import { AdminMiddlewareWrapper } from '../middleware/index-admin';
import { adminCheckWhitelistIp } from '../middleware/admin-check-whitelist-ip';

export const receiveCompute: lambda.Handler = async (event: lambda.SQSEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse|AllResponse> => {
    console.log(event);

    return ResponseService.baseResponseJson(200, 'Test Compute', null);
}

export const receiveSNS: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const data = JSON.parse(event.body || '{}');
        // const response: any = notifData;
        console.log("SUCCESS", data);
        if (data?.Type && data.Type == 'SubscriptionConfirmation') {
            const helperService = new HelperService();
            const url = data.SubscribeURL;
            const response = await helperService.get(url);

            if (response.status === 200) {
                console.log('Subscription confirmed successfully');
            } else {
                console.error('Failed to confirm subscription:', response.statusText);
            }
        } else {
            const message = JSON.parse(data.Message);
            const payload = JSON.parse(message.body);
            console.log("THIS IS THE PAYLOAD SENT BY SQS", payload);
            if (message.eventSourceARN === process.env.SQS_QUEST_ARN) {
                console.log(`START HANDLE RESTART QUEST MESSAGE FROM: ${message.eventSourceARN} WITH ID: #${message.messageId}`);
                await handleQuestQueueFromSNS(payload);
            }
            if (message.eventSourceARN === process.env.SQS_RAFFLES_ARN) {
                console.log(`START HANDLE RAFFLE QUEUE MESSAGE FROM: ${message.eventSourceARN} WITH ID: #${message.messageId}`);
                await handleRaffleTicketQueueFromSNS(payload);
            }
            if (message.eventSourceARN === process.env.SQS_NOTIFICATIONS_ARN) {
                console.log(`START HANDLE NOTIFICATION QUEUE MESSAGE FROM: ${message.eventSourceARN} WITH ID: #${message.messageId}`);
                await handleNotificationQueueFromSNS(payload)
            }
            if (message.eventSourceARN === process.env.SQS_MESSAGES_ARN) {
                console.log(`START HANDLE NOTIFICATION MESSAGE QUEUE MESSAGE FROM: ${message.eventSourceARN} WITH ID: #${message.messageId}`);
                await handleNotificationMessagesQueueFromSNS(payload)
            }
        }
        return ResponseService.baseResponseJson(200, 'Test receive SNS', null);
    } catch (error: any) {
        console.log("ERROR RECEIVE SNS", error)
        return ResponseService.baseResponseJson(500, 'Test receive SNS', {error: error.message || 'Something error'});
    }
}

export const testGetNotif: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const lambdaService     = new LambdaService();
    const functionName      = `${process.env.LAMBDA_GET_NOTIF}`;
    const payload           = { 
        pathParameters: { userId: 2 }
    };

    const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
    const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
    const response          = await lambdaService.invokeLambda(functionName, payload, accessKeyId, secretAccessKey, 'ap-southeast-1');
    const data = JSON.parse(response.body);
    // const response: any = notifData;
    console.log("SUCCESS", data);
    return ResponseService.baseResponseJson(200, 'Test lambda invoke', null);
}

export const sendCompute: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse|AllResponse> => {
    const sqsService    = new SQSService();
    const sqsUrl        = process.env.SQS_URL;
    if (!sqsUrl) return ResponseService.baseResponseJson(400, 'No SQS URL', null);

    const queueName         = sqsUrl.split('/')[sqsUrl.split('/').length - 1];
    const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
    const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
    await sqsService.sendSQSMessage(queueName, accessKeyId, secretAccessKey, JSON.stringify({
        inop: 'okay'
    }), process.env.AWS_REGION_ENV);

    return ResponseService.baseResponseJson(200, 'Test Compute', null);
}

/** DUITKU TESTING */
/** bank_account testing */
// 8760673566	00	Berhasil
// 8760673511	TO	Waktu habis
// 8760673512	-100	Kesalahan lainnya
// 8760673513	LD	Link Down
// 8760673514	91	DB bermasalah
// 8760673515	89	Link ke host Down

/** bank_code list */
// 002	Bank BRI	✓
// 008	Bank Mandiri	✓
// 009	Bank BNI	✓
// 011	Bank Danamon	✓
// 013	Bank Permata	✓
// 014	Bank Central Asia	✓
// 016	Bank Maybank Indonesia	✗
// 019	Bank Panin	✓
// 022	CIMB Niaga	✓
// 023	Bank UOB Indonesia	✓
// 028	Bank OCBC NISP	✓
// 031	Citi Bank	✓
// 036	Bank CCB (Ex-Bank Windu Kentjana)	✗
// 037	Bank Artha Graha	✓
// 042	MUFG Bank	✗
// 046	Bank DBS	✓
// 050	Standard Chartered Bank	✗
// 054	Bank Capital	✗
// 061	ANZ Indonesia	✗
// 069	Bank Of China	✗
// 076	Bank Bumi Arta	✓
// 087	Bank HSBC Indonesia	✓
// 095	Bank JTrust Indonesia	✗
// 097	Bank Mayapada	✗
// 110	Bank BJB	✓
// 111	Bank DKI	✓
// 112	Bank BPD DIY	✗
// 113	Bank Jateng	✓
// 114	Bank Jatim	✓
// 115	Bank Jambi	✗
// 116	Bank Aceh	✗
// 117	Bank Sumut	✗
// 118	Bank Nagari	✗
// 119	Bank Riau Kepri	✓
// 120	Bank Sumsel Babel	✗
// 121	Bank Lampung	✗
// 122	Bank Kalsel	✗
// 123	Bank Kalbar	✗
// 124	Bank Kaltimtara	✗
// 125	Bank Kalteng	✗
// 126	Bank Sulselbar	✗
// 127	Bank Sulut Go	✗
// 128	Bank NTB Syariah	✗
// 129	Bank BPD Bali	✓
// 130	Bank NTT	✓
// 131	Bank Maluku Malut	✗
// 132	Bank Papua	✓
// 133	Bank Bengkulu	✗
// 134	Bank Sulteng	✗
// 135	Bank Sultra	✗
// 137	Bank Banten	✗
// 146	Bank Of India Indonesia	✗
// 147	Bank Muamalat Indonesia	✗
// 151	Bank Mestika	✓
// 152	Bank Shinhan Indonesia	✗
// 153	Bank Sinarmas	✓
// 157	Bank Maspion Indonesia	✓
// 161	Bank Ganesha	✓
// 164	Bank ICBC Indonesia	✗
// 167	Bank QNB Indonesia	✗
// 200	Bank BTN	✓
// 212	Bank Woori Saudara	✓
// 213	Bank BTPN	✗
// 405	Bank Victoria Syariah	✗
// 425	Bank BJB Syariah	✓
// 426	Bank Mega	✓
// 441	Bank Bukopin	✗
// 451	Bank Syariah Indonesia	✓
// 472	Bank Jasa Jakarta	✗
// 484	Bank KEB Hana	✓
// 485	MNC Bank	✗
// 490	Bank Neo Commerce	✗
// 494	Bank BRI Agroniaga	✓
// 498	Bank SBI	✗
// 501	Bank Digital BCA	✓
// 503	Bank Nobu	✓
// 506	Bank Mega Syariah	✗
// 513	Bank Ina Perdana	✓
// 517	Bank Panin Dubai Syariah	✗
// 520	Bank Prima Master	✗
// 521	Bank Syariah Bukopin	✗
// 523	Bank Sahabat Sampoerna	✓
// 526	Bank Oke Indonesia	✗
// 531	AMAR BANK	✗
// 535	SEA Bank	✗
// 536	Bank BCA Syariah	✓
// 542	Bank Jago	✓
// 547	Bank BTPN Syariah	✗
// 548	Bank Multiarta Sentosa	✓
// 553	Bank Mayora	✗
// 555	Bank Index Selindo	✗
// 564	Bank Mantap	✓
// 566	Bank Victoria International	✗
// 567	Allo Bank	✓
// 600	BPR/LSB	✗
// 688	BPR KS	✗
// 699	BPR EKA	✗
// 789	IMkas	✗
// 911	LinkAja	✗
// 945	Bank Agris	✗
// 949	Bank Chinatrust Indonesia	✗
// 947	Bank Aladin Syariah	✗
// 950	Bank Commonwealth	✗
// 1010	OVO	✗
// 1012	DANA	✗
// 1013	Shopeepay	✗
// 1014	LinkAja Direct	✗

export const duitkuInquiry: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection    = await new Database().getConnection();
    const duitkuService = new DuitkuService(connection);

    const body = event.body;
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

    const inquiryResponse = await duitkuService.inquiry({
        amount          : parsedBody.amount,
        bank_account    : parsedBody.bank_account,
        bank_code       : parsedBody.bank_code,
        purpose         : parsedBody.purpose,
        sender_name     : parsedBody.sender_name,
        user_id         : 2
    });

    if(!inquiryResponse.success){
        return ResponseService.baseResponseJson(422, 'Something wrong with Duitku CallAPI', null);
    }
       
    return ResponseService.baseResponseJson(200, 'Test inquiry processed', {});
}

export const duitkuTransfer: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection    = await new Database().getConnection();
    const duitkuService = new DuitkuService(connection);

    const body = event.body;
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

    const transferResponse = await duitkuService.transfer({
        disburse_id     : parsedBody.disburse_id,
        amount          : parsedBody.amount,
        bank_account    : parsedBody.bank_account,
        bank_code       : parsedBody.bank_code,
        purpose         : parsedBody.purpose,
        account_name    : parsedBody.account_name,
        cust_ref_number : parsedBody.cust_ref_number
    });

    if(!transferResponse.success){
        return ResponseService.baseResponseJson(422, 'Something wrong with duitku transfer API', null);
    }
       
    return ResponseService.baseResponseJson(200, 'Test transfer processed', {});
}

export const testNotif: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    // const firebaseService   = new FirebaseService();
    // const sendMessage       = await firebaseService.sendNotification('aa', {title: "Test Notification", body: "This is sample notification, please ignore"});
    return ResponseService.baseResponseJson(200, 'Test transfer processed', {});
}

export const testRaffleQueueSend: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const connection    = await new Database().getConnection();
    const raffleService = new RaffleService(connection);
    const helperService = new HelperService();

    // const totalTicket   = await raffleService.getTotalSubmittedTicket(11);
    const body: any     = event.body ? JSON.parse(event.body) : {};
    const coupons       = body?.coupons || 0;

    const mappedTickets: Array<RaffleTicketSchema> = [];
    for (let count = 1; count <= coupons; count++) {
        mappedTickets.push({
            raffle_id: 11,
            user_id: 2,
            ticket_no: `${helperService.generateRandomNumber(10)}`
        })
    }

    await raffleService.sendTicketsToQueue(mappedTickets);
    return ResponseService.baseResponseJson(200, 'RaffleTicket sent to Queue', {});
}

export const testAWDPrepaid: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const connection    = await new Database().getConnection();
    const awdService    = new AwdService(connection);
    const helperService = new HelperService();

    const body = event.body;
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

    await awdService.prepaid({
        msisdn      : parsedBody.msisdn,
        product_id  : parsedBody.product_id
    });

    return ResponseService.baseResponseJson(200, 'Processed', {});
}

export const midtransAccountValidation: lambda.Handler = async (event: lambda.APIGatewayEvent, Context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection    = await new Database().getConnection();
    const midtransService = new MidtransService(connection);

    const queryParams = event.queryStringParameters || {};
    console.log('Query parameters:', queryParams.account);

    const transferResponse = await midtransService.accountValidation({
        bank: "gopay",
        account: "089658155683"
    });

    if(!transferResponse.success){
        return ResponseService.baseResponseJson(422, 'Something wrong with midtrans account validation API', null);
    }
       
    return ResponseService.baseResponseJson(200, 'Test account validation processed', transferResponse);
}

export const midtransCreatePayout: lambda.Handler = async (event: lambda.APIGatewayEvent, Context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection    = await new Database().getConnection();
    const midtransService = new MidtransService(connection);

    const body = event.body;
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

    const createPayoutResponse = await midtransService.createPayout({
        payouts : parsedBody.payouts
    });

    if(!createPayoutResponse.success){
        return ResponseService.baseResponseJson(422, 'Something wrong with midtrans create payout API', null);
    }
       
    return ResponseService.baseResponseJson(200, 'Test create payout processed', createPayoutResponse);
} 

export const midtransApprovePayout: lambda.Handler = async (event: lambda.APIGatewayEvent, Context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection    = await new Database().getConnection();
    const midtransService = new MidtransService(connection);

    const body = event.body;
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

    const approvePayoutResponse = await midtransService.approvePayout({
        reference_nos: parsedBody.reference_nos,

    });

    if(!approvePayoutResponse.success){
        return ResponseService.baseResponseJson(422, 'Something wrong with midtrans approve payout API', null);
    }
       
    return ResponseService.baseResponseJson(200, 'Test approve payout processed', approvePayoutResponse);
}

exports.receiveCompute        = new AdminMiddlewareWrapper().init(receiveCompute, [adminCheckWhitelistIp()]);
// exports.receiveSNS            = new AdminMiddlewareWrapper().init(receiveSNS, [adminCheckWhitelistIp()]);
// exports.testGetNotif          = new AdminMiddlewareWrapper().init(testGetNotif, [adminCheckWhitelistIp()]);
// exports.sendCompute           = new AdminMiddlewareWrapper().init(sendCompute, [adminCheckWhitelistIp()]);
// exports.duitkuInquiry         = new AdminMiddlewareWrapper().init(duitkuInquiry, [adminCheckWhitelistIp()]);
// exports.duitkuTransfer        = new AdminMiddlewareWrapper().init(duitkuTransfer, [adminCheckWhitelistIp()]);
// exports.testNotif             = new AdminMiddlewareWrapper().init(testNotif, [adminCheckWhitelistIp()]);
// exports.testRaffleQueueSend   = new AdminMiddlewareWrapper().init(testRaffleQueueSend, [adminCheckWhitelistIp()]);
// exports.testAWDPrepaid        = new AdminMiddlewareWrapper().init(testAWDPrepaid, [adminCheckWhitelistIp()]);
// exports.midtransAccountValidation= new AdminMiddlewareWrapper().init(midtransAccountValidation, [adminCheckWhitelistIp()]);
// exports.midtransCreatePayout  = new AdminMiddlewareWrapper().init(midtransCreatePayout, [adminCheckWhitelistIp()]);
// exports.midtransApprovePayout = new AdminMiddlewareWrapper().init(midtransApprovePayout, [adminCheckWhitelistIp()]);