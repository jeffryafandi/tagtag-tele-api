import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";

export const MysteryBoxFillable = [
    'mystery_box_config_id',
    'coin',
    'coupon',
    'activity_point',
    'user_id',
    'is_claimed',
    'expired_at'
];

export const MysteryBoxUpdateable = MysteryBoxFillable;

@Entity()
export class MysteryBoxes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("bigint")
    mystery_box_config_id!: number;

    @Column("int")
    coin!: number;

    @Column("int")
    coupon?: number;

    @Column("int")
    activity_point?: number;

    @Column("bigint")
    user_id?: number;

    @Column("tinyint")
    is_claimed!: boolean;

    @Column()
    expired_at!: string;

   @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;
}