import { BaseNotificationData } from "./firebase";

export type NotifMessageQueueRequest = {
    token           : string,
    message         : BaseNotificationData,
    data            : Record<string, any>,
    notification    : NotificationQueueDataRequest
}

export type NotificationQueueDataRequest = {
    notification_id : number;
    parameters      : Record<string, any>;
    to              : 'all' | string[]
}
export interface NotificationQueueRequest {
    type: string;
    data: NotificationQueueDataRequest
}