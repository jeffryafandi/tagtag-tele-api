import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { UserService } from '../services/user';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { SchedulerService } from '../services/scheduler';
import { QuestService } from '../services/quest';
import { MissionService } from '../services/mission';
import { PrizepoolService } from '../services/prizepool';
import dayjs from 'dayjs';
import { NotificationService } from '../services/fcm-notification';
import { NOTIF_CODE } from '../config/notif-constant';
import { UserActivityService } from '../services/user-activity';
import { RaffleService } from '../services/raffle';
import { ASSIGN_USER_QUEST_CHUNK_SIZE, ASSIGN_USER_QUEST_CHUNK_SIZE2 } from '../config/constants';
import { QUEUE_TYPE } from '../config/queue-constant';
import { HelperService } from '../services/helper';
import { MysteryBoxService } from '../services/mystery-box';
import { SQSService } from '../services/aws/sqs';
import { InAppPurchaseService } from '../services/in-app-purchase';
import { AdminMiddlewareWrapper } from '../middleware/index-admin';
import { adminCheckWhitelistIp } from '../middleware/admin-check-whitelist-ip';
import { MidtransService } from '../services/midtrans';
import { MidtransCustomerTopupRequest, CustomerTopupValueRequest, CustomerTopUpAdditionalInfoRequest } from "../interfaces/requests/midtrans";
import { PrizeDistributionsType } from '../interfaces/requests/prizepool';

export const markDailyLogin: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);   
        const dailyLoginUsers   = await schedulerService.getCurrentDailyLoginUsers();

        await schedulerService.markDailyLogin(dailyLoginUsers);

        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const resetLuckyWheel: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    console.log(`TRIGGER: resetLuckyWheel @ ${dayjs().format('YYYY-MM-DDTHH:mm:ss')}`);
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);

        await schedulerService.resetLuckyWheel()
        
        return ResponseService.baseResponseJson(200, 'Reset Successfully', {
        });
    });
}

export const validateStoreUserPurchase: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const inAppPurchaseService  = new InAppPurchaseService(connection);

        const result = await inAppPurchaseService.validateStoreUserPurchase()
       
        return ResponseService.baseResponseJson(200, result, {});
    });
}

// coba dibikin lempar ke SQS, karena ini akan memakan waktu 1 menit lebih jika dijalankan secara langsung
export const reassignQuestPreset: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService          = new SchedulerService(connection);
        const questService              = new QuestService(connection); 

        // sementara reset untuk regular dulu
        // await questService.completeClaimedUserQuest();
        // await schedulerService.resetClaimedCompleteQuestPrize();

        // sementara assign untuk regular dulu
        // await questService.assignQuestsByPresetId(1);

        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const reassignQuest2: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    console.log(`TRIGGER: reassignQuest @ ${dayjs().format('YYYY-MM-DDTHH:mm:ss')}`);
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService          = new SchedulerService(connection);
        const questService              = new QuestService(connection); 
        const userService               = new UserService(connection); 
        const sqsService                = new SQSService();
        const users                     = await userService.getAllActiveUserIds();
        const userIds                   = users.map(user => user.id);
        const chunked: Array<number[]>  = [];

        await questService.completeClaimedUserQuest();
        await schedulerService.resetClaimedCompleteQuestPrize();
        for (let i = 0; i < userIds.length; i += ASSIGN_USER_QUEST_CHUNK_SIZE2) {
            const chunk = userIds.slice(i, i + ASSIGN_USER_QUEST_CHUNK_SIZE2);
            chunked.push(chunk);
        }

        let queueCount = 1;
        for (const chunk of chunked) {
            
            const message = {
                type: QUEUE_TYPE.ASSIGN_USER_QUEST,
                data: chunk
            }
            const queueUrl = process.env.SQS_QUEST_URL;
            if (queueUrl) {
                const queueName         = queueUrl.split('/')[queueUrl.split('/').length - 1];
                const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
                const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
                console.log("THIS IS THE MESSAGE", message);
                const queueResponse     = await sqsService.sendSQSMessage(queueName, accessKeyId, secretAccessKey, JSON.stringify(message), process.env.AWS_REGION_ENV);
                console.log(`SUCCESS SENDING QUEUE assignQuest #${queueCount} @ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}:`, queueResponse);
                queueCount++;
            }
            // await sqsService.sendQueue(JSON.stringify(message), `${process.env.SQS_QUEST_URL || ''}`);
        }

        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const reassignQuest: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    console.log(`TRIGGER: reassignQuest @ ${dayjs().format('YYYY-MM-DDTHH:mm:ss')}`);
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService          = new SchedulerService(connection);
        const questService              = new QuestService(connection); 
        const userService               = new UserService(connection); 
        const sqsService                = new SQSService();
        const users                     = await userService.getAllActiveUserIds();
        const userIds                   = users.map(user => user.id);
        const chunked: Array<number[]>  = [];

        await questService.completeClaimedUserQuest();
        await schedulerService.resetClaimedCompleteQuestPrize();
        for (let i = 0; i < userIds.length; i += ASSIGN_USER_QUEST_CHUNK_SIZE) {
            const chunk = userIds.slice(i, i + ASSIGN_USER_QUEST_CHUNK_SIZE);
            chunked.push(chunk);
        }

        let queueCount = 1;
        for (const chunk of chunked) {
            
            const message = {
                type: QUEUE_TYPE.ASSIGN_USER_QUEST,
                data: chunk
            }
            const queueUrl = process.env.SQS_QUEST_URL;
            if (queueUrl) {
                const queueName         = queueUrl.split('/')[queueUrl.split('/').length - 1];
                const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
                const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
                console.log("THIS IS THE MESSAGE", message);
                const queueResponse     = await sqsService.sendSQSMessage(queueName, accessKeyId, secretAccessKey, JSON.stringify(message), process.env.AWS_REGION_ENV);
                console.log(`SUCCESS SENDING QUEUE assignQuest #${queueCount} @ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}:`, queueResponse);
                queueCount++;
            }
            // await sqsService.sendQueue(JSON.stringify(message), `${process.env.SQS_QUEST_URL || ''}`);
        }

        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const refreshMission: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const missionService    = new MissionService(connection); 

        await missionService.getCompleteMissionList(); 
        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const resetMission: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const missionService    = new MissionService(connection); 

        await missionService.resetMission(); 
        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const calculatePrizepool: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const prizepoolService  = new PrizepoolService(connection);
            const success           = await prizepoolService.concludePrizepoolByDate();
    
            if (!success) return ResponseService.baseResponseJson(422, 'Cannot calculate prizepool', {error: 'No active prizepool at this period'});
            return ResponseService.baseResponseJson(200, 'Success', {})
        } catch (error: any) {
            console.log(error)
            return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
        }
    });
}

export const calculateVipPrizepool: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        try {
            const prizepoolService  = new PrizepoolService(connection);
            const success           = await prizepoolService.concludePrizepoolByDate();
    
            if (!success) return ResponseService.baseResponseJson(422, 'Cannot calculate prizepool', {error: 'No active prizepool at this period'});
            return ResponseService.baseResponseJson(200, 'Success', {})
        } catch (error: any) {
            console.log(error)
            return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)});
        }
    });
}


export const sendingNotification: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const notificationService   = new NotificationService(connection);

        await notificationService.sendAvailableFcmNotifications();
        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const checkRaffleStatus: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const raffleService = new RaffleService(connection);

        await raffleService.finishingRaffles();
        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const checkUserActivity: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const userActivityService   = new UserActivityService(connection);
        const date                  = dayjs().subtract(7, 'hours').subtract(5, 'minutes').format('YYYY-MM-DDTHH:mm:ss')
        console.log("DATE", date)

        await userActivityService.setIdleUserToOffline(date);
        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const expireUserBan: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    console.log(`TRIGGER: expireUserBan @ ${dayjs().format('YYYY-MM-DDTHH:mm:ss')}`);
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const userService   = new UserService(connection);

        const canExpiredBans= await userService.findUserBans({ canExpired: true });
        if (canExpiredBans.length > 0) {
            for (const ban of canExpiredBans) {
                const now       = dayjs().valueOf();
                const created   = helperService.toDateTime(dayjs(ban.created_at));
                const expired   = dayjs(helperService.addHours(created, ban.expired_in)).valueOf();
                if (now > expired) {
                    // test here
                    await userService.updateBan(ban.id, { is_expired: true });
                }
            }
        }
        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const generateMysteryBoxPrizes: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        // const userService       = new UserService(connection);
        const helperService     = new HelperService();
        const mysteryBoxService = new MysteryBoxService(connection);
        await mysteryBoxService.generateDailyBoxes();
        return ResponseService.baseResponseJson(200, 'Success', {});
    });
}

export const resetStamina: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const connection        = await new Database().getConnection();
    const schedulerService  = new SchedulerService(connection);

    await schedulerService.resetStamina()
       
    return ResponseService.baseResponseJson(200, 'Reset Successfully', {
    });
}

export const backupUserQuests: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);

        await schedulerService.backupUserQuests()
        
        return ResponseService.baseResponseJson(200, 'Reset Successfully', {
        });
    });
}

export const backupRaffleTickets: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);

        await schedulerService.backupRaffleTickets()
        
        return ResponseService.baseResponseJson(200, 'Reset Successfully', {
        });
    });
}

export const redisSetTotalPools: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);

        await schedulerService.redisSetTotalPools()
        
        return ResponseService.baseResponseJson(200, 'Cached Set Successfully', {
        });
    });
}

export const redisSetLeaderboardDaily: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);

        await schedulerService.redisSetLeaderboard(PrizeDistributionsType.daily)
        
        return ResponseService.baseResponseJson(200, 'Cached Set Successfully', {
        });
    });
}

export const redisSetLeaderboardWeekly: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);

        await schedulerService.redisSetLeaderboard(PrizeDistributionsType.weekly)
        
        return ResponseService.baseResponseJson(200, 'Cached Set Successfully', {
        });
    });
}

export const redisSetWinnersData: lambda.Handler = async (event: lambda.APIGatewayEvent, context: lambda.Context, callback: lambda.Callback): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const schedulerService  = new SchedulerService(connection);

        await schedulerService.redisSetWinnersData()
        
        return ResponseService.baseResponseJson(200, 'Cached Set Successfully', {
        });
    });
}

// exports.markDailyLogin            = new AdminMiddlewareWrapper().init(markDailyLogin, [adminCheckWhitelistIp()]);
// exports.resetLuckyWheel           = new AdminMiddlewareWrapper().init(resetLuckyWheel, [adminCheckWhitelistIp()]);
// exports.validateStoreUserPurchase = new AdminMiddlewareWrapper().init(validateStoreUserPurchase, [adminCheckWhitelistIp()]);
// exports.reassignQuest             = new AdminMiddlewareWrapper().init(reassignQuest, [adminCheckWhitelistIp()]);
// exports.refreshMission            = new AdminMiddlewareWrapper().init(refreshMission, [adminCheckWhitelistIp()]);
// exports.calculatePrizepool        = new AdminMiddlewareWrapper().init(calculatePrizepool, [adminCheckWhitelistIp()]);
// exports.sendingNotification       = new AdminMiddlewareWrapper().init(sendingNotification, [adminCheckWhitelistIp()]);
// exports.checkRaffleStatus         = new AdminMiddlewareWrapper().init(checkRaffleStatus, [adminCheckWhitelistIp()]);
// exports.checkUserActivity         = new AdminMiddlewareWrapper().init(checkUserActivity, [adminCheckWhitelistIp()]);
// exports.expireUserBan             = new AdminMiddlewareWrapper().init(expireUserBan, [adminCheckWhitelistIp()]);
// exports.generateMysteryBoxPrizes  = new AdminMiddlewareWrapper().init(generateMysteryBoxPrizes, [adminCheckWhitelistIp()]);