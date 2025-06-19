import { LuckyWheels } from "../../entities/lucky-wheels";

enum sortByEnum {
    ASC     = "ASC",
    DESC    = "DESC"
}

export interface FilterLuckyWheels {
    id?             : number;
    name?           : string;
    page?           : number;
    sort?           : string;
    sortBy?         : sortByEnum;
    luckyWheelId?   : string;
    username?       : string;
};

export interface CreateLuckyWheels {
    name           : string;
};

export interface CreateLuckyWheelPrizes {
    luckyWheel                       : LuckyWheels;
    coupon_prize?                    : number;
    coin_prize?                      : number;
    game_inventory_id?               : number;
    lucky_wheel_spin_entry_prize?    : number;
    activity_point_prize?            : number;

};

export interface UpdateLuckyWheels {
    name?           : string;
    is_active?      : boolean;
   
};

export interface UpdateLuckyWheelPrizes {
    coupon_prize?                    : number;
    coin_prize?                      : number;
    game_inventory_id?               : number;
    lucky_wheel_spin_entry_prize?    : number;
    activity_point_prize?            : number;
   
};