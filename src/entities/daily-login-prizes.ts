import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { DailyLogins } from "./daily-logins";
import { DailyLoginUsers } from "./daily-login-users";

export const DailyLoginPrizesFillable = [
   'daily_login_id',
   'day',
   'coupon_prize',
   'activity_point_prize',
   'coin_prize'
];

export const DailyLoginPrizesUpdateable = [
   'daily_login_id',
   'day',
   'coupon_prize',
   'activity_point_prize',
   'coin_prize'
];

@Entity()
export class DailyLoginPrizes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    daily_login_id!: number;

    @Column()
    day!: number;
    
    @Column()
    coupon_prize!: number;
    
    @Column()
    coin_prize!: number;
    
    @Column()
    activity_point_prize!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => DailyLogins, dailyLogin => dailyLogin.dailyLoginPrizes)
    @JoinColumn({
        name: "daily_login_id"
    })
    dailyLogin?: DailyLogins;

    @OneToMany(type => DailyLoginUsers, dailyLoginUsers => dailyLoginUsers.dailyLoginPrize)
    dailyLoginUsers?: DailyLoginUsers[];
}