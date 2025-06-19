enum sortByEnum {
    ASC     = "ASC",
    DESC    = "DESC"
}

export type RaffleTicketSchema = {
    raffle_id   : number;
    user_id     : number; 
    ticket_no   : string
}

export interface FilterRaffle {
    id?         : number;
    username?   : string;
    page?       : number;
    sort?       : string;
    sortBy?     : sortByEnum;
};