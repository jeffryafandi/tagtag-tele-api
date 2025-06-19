import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { DailyLoginUsers } from "./daily-login-users";
import { DailyLoginPrizes } from "./daily-login-prizes";

export const DailyLoginsFillable = [
    'name',
    'is_active'
];

export const DailyLoginsUpdateable = [
    'name',
    'is_active'
];

@Entity()
export class DailyLogins {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    is_active!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => DailyLoginUsers, dailyLoginUsers => dailyLoginUsers.dailyLogin)
    dailyLoginUsers?: DailyLoginUsers[];

    @OneToMany(type => DailyLoginPrizes, dailyLoginPrize => dailyLoginPrize.dailyLogin)
    dailyLoginPrizes!: DailyLoginPrizes[];
}