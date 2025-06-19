import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { DailyLogins } from "./daily-logins";
import { DailyLoginPrizes } from "./daily-login-prizes";
import { Users } from "./users";

export const DailyLoginUsersFillable = [
    'user_id',
    'daily_login_id',
    'daily_login_prize_id',
    'is_claimed_today',
    'is_completed'
];

export const DailyLoginUsersUpdateable = [
    'user_id',
    'daily_login_id',
    'daily_login_prize_id',
    'is_claimed_today',
    'is_completed'
];

@Entity()
export class DailyLoginUsers {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;
    
    @Column()
    daily_login_id!: number;
    
    @Column()
    daily_login_prize_id!: number;

    @Column()
    is_claimed_today!: boolean;

    @Column()
    is_completed!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => Users, user => user.dailyLoginUsers)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;

    @ManyToOne(type => DailyLogins, dailyLogins => dailyLogins.dailyLoginUsers)
    @JoinColumn({
        name: "daily_login_id"
    })
    dailyLogin?: DailyLogins;
   
    @ManyToOne(type => DailyLoginPrizes, dailyLoginPrizes => dailyLoginPrizes.dailyLoginUsers)
    @JoinColumn({
        name: "daily_login_prize_id"
    })
    dailyLoginPrize?: DailyLoginPrizes;
}