interface ITelegramChat {
    id      : number;
    title   : string,
    type    : string
}

interface ITelegramSendMessageResult {
    message_id  : 3;
    sender_chat : ITelegramChat;
    chat        : ITelegramChat;
    date        : number;
    text        : string;
}

export interface ITelegramSendMessageResponse {
    ok      : boolean;
    result  : ITelegramSendMessageResult
}