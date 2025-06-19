import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";

export const BanFillable = [
    'user_id',
    'ban_reason',
    'is_expired',
    'expired_in'
];

export const BanUpdateable = BanFillable;

@Entity()
export class UserBans {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "int"})
    user_id!: number;

    @Column({type: "varchar"})
    ban_reason!: string;

    @Column({type: "tinyint"})
    is_expired!: boolean;
    
    @Column({type: "int"})
    expired_in!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @ManyToOne(type => Users, user => user.bans)
    @JoinColumn({name: 'user_id'})
    user!: Users
}