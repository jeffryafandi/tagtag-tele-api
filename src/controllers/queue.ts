import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { RaffleService } from '../services/raffle';
import { ResponseService } from '../services/response';
import { BaseResponse } from '../interfaces/generals/response';
import { NotificationService } from '../services/fcm-notification';
import { QuestService } from '../services/quest';
import { NOTIF_CODE } from '../config/notif-constant';
import { GameService } from '../services/game';
import { NotifMessageQueueRequest, NotificationQueueRequest } from '../interfaces/requests/notification';
import { QUEST_PRESET_VIP_ID, QUEST_PRESET_REGULAR_ID } from "../config/constants";
import { UserService } from '../services/user';

export const handleRaffleTicketQueueFromSNS = async (message: {type: string, data: any}) => {
    const conn          = await new Database().getConnection();
    const raffleService = new RaffleService(conn);
    await raffleService.handleRaffleTicketQueue(message.data);
}

export const handleNotificationQueueFromSNS = async (message: NotificationQueueRequest) => {
    const connnection           = await new Database().getConnection();
    const notificationService   = new NotificationService(connnection);
    await notificationService.handleNotificationQueue(message.data);
}

export const handleNotificationMessagesQueueFromSNS = async (message: {type: string, data: NotifMessageQueueRequest[]}) => {
    const connnection           = await new Database().getConnection();
    const notificationService   = new NotificationService(connnection);
    await notificationService.handleNotifMessageQueue(message.data);
}

export const handleQuestQueueFromSNS = async (message: {type: string, data: number[]}) => {
    const connection            = await new Database().getConnection();
    const notificationService   = new NotificationService(connection);
    const questService          = new QuestService(connection);
    const gameService           = new GameService(connection);
    const userService           = new UserService(connection);
    // const games                 = await gameService.getAllGames();

    const userIds               = message.data;
    for (const userId of userIds) {
        const userVip = await userService.isVip(userId);
        const presetId = userVip ? QUEST_PRESET_VIP_ID : QUEST_PRESET_REGULAR_ID;
        const games     = await gameService.getAllGames(presetId);
        try {
            await questService.assignInitialQuest(userId, games, presetId);
        } catch (error) {
            console.log(`"[questHandlerQueue.assignQuest] Failed for userID: ${userId}`, error);
        }
    }

    try {
        await notificationService.sendNotificationByCode(NOTIF_CODE.DAILY_QUEST_RESET, userIds.map((id) => `${id}`));
    } catch (error) {
        console.log("ERROR WHEN SENDING NOTIF");   
    }
}

export const raffleTicketHandlerQueue: lambda.Handler = async (event: lambda.SQSEvent): Promise<BaseResponse> => { 
    const records       = event.Records;
    const conn          = await new Database().getConnection();
    const raffleService = new RaffleService(conn);

    for (const record of records) {
        const body  = record.body ? JSON.parse(record.body) : undefined;
        if (body) {
            await raffleService.handleRaffleTicketQueue(body.data);
        }   
    }

    return ResponseService.baseResponseJson(200, 'Test Compute', null);
}
export const notificationHandlerQueue: lambda.Handler = async (event: lambda.SQSEvent): Promise<BaseResponse> => {
    try {
        const records               = event.Records;
        const connnection           = await new Database().getConnection();
        const notificationService   = new NotificationService(connnection);
        console.log("[notificationHandlerQueue] receive message, event.Records", event.Records);
        
        for (const record of records) {
            const body  = record.body ? JSON.parse(record.body) : undefined;
            if (body) {
                await notificationService.handleNotificationQueue(body.data);
            }   
        }
        return ResponseService.baseResponseJson(200, 'Notification message is received', null);
    } catch (error: any) {
        console.log("THERE'S ERROR",error);
        return ResponseService.baseResponseJson(500, 'Notification message not handled', null);
    }
}

export const notifMessageHandlerQueue: lambda.Handler = async (event: lambda.SQSEvent): Promise<BaseResponse> => {
    const records               = event.Records;
    const connnection           = await new Database().getConnection();
    const notificationService   = new NotificationService(connnection);

    console.log("[notifMessageHandlerQueue] receive message, event.Records", event.Records);
    
    for (const record of records) {
        const body  = record.body ? JSON.parse(record.body) : undefined;
        if (body) {
            await notificationService.handleNotifMessageQueue(body.data);
        }   
    }

    return ResponseService.baseResponseJson(200, 'Message queue is received', null);
}

// export const questHandlerQueue: lambda.Handler = async (event: lambda.SQSEvent): Promise<BaseResponse> => {
//     const records = event.Records;
//     const connection = await new Database().getConnection();
//     const notificationService = new NotificationService(connection);
//     const questService = new QuestService(connection);

//     console.log("[questHandlerQueue] receive message, event.Records: ", records);

//     for (const record of records) {
//         const body = record.body ? JSON.parse(record.body) : null;
//         if (!body) {
//             console.warn("Invalid message body, skipping:", body);
//             continue;
//         }

//         const userIds   = body.data as number[];

//         try {
//             await questService.assignQuestsByPresetId(1, userIds);
//         } catch (error) {
//             console.error(`[questHandlerQueue] ERROR WHEN ASSIGNING QUEST for userIds: ${JSON.stringify(userIds)}`, error);
//         }

//         try {
//             await notificationService.sendNotificationByCode(
//                 NOTIF_CODE.DAILY_QUEST_RESET,
//                 userIds.map((id: number) => `${id}`)
//             );
//         } catch (error) {
//             console.error(`[questHandlerQueue] ERROR WHEN SENDING NOTIFICATION for userIds: ${JSON.stringify(userIds)}`, error);
//         }
//     }

//     return ResponseService.baseResponseJson(200, 'Message queue is processed', null);
// };


export const questHandlerQueue: lambda.Handler = async (event: lambda.SQSEvent): Promise<BaseResponse> => {
    const records               = event.Records;
    const connection            = await new Database().getConnection();
    const notificationService   = new NotificationService(connection);
    const questService          = new QuestService(connection);
    const gameService           = new GameService(connection);
    const userService           = new UserService(connection);
    console.log("[questHandlerQueue] receive message, event.Records: ", records);

    for (const record of records) {
        const body = record.body ? JSON.parse(record.body) : null;
        if (body) {
            // const games     = await gameService.getAllGames();
            const userIds   = body.data as number[];
            for (const userId of userIds) {
                const userVip = await userService.isVip(userId);
                const presetId = userVip ? QUEST_PRESET_VIP_ID : QUEST_PRESET_REGULAR_ID;
                const games     = await gameService.getAllGames(presetId);
                try {
                    await questService.assignInitialQuest(userId, games, presetId);
                } catch (error) {
                    console.log(`"[questHandlerQueue.assignQuest] Failed for userID: ${userId}`, error);
                }
            }

            try {
                await notificationService.sendNotificationByCode(NOTIF_CODE.DAILY_QUEST_RESET, userIds.map((id) => `${id}`));
            } catch (error) {
                console.log("ERROR WHEN SENDING NOTIF");   
            }
        }
    }

    return ResponseService.baseResponseJson(200, 'Message queue is processed', null);
}