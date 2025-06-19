export type BaseNotificationData = {
    title   : string,
    body    : string,
    imageUrl?: string
}

export type BaseNotificationDataType = {
    [key: string]: string
}

export interface BaseFirebaseMessageRequest {
    token       : string;
    notification: BaseNotificationDataType;
    data        ?: BaseNotificationDataType;
    android     : {
        direct_boot_ok: boolean
    }
}