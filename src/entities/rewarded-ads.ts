import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

export const RewardedAdsFillable = [
    'name',
    'reward_type',
    'reward_value',
    'position',
    'is_active'
];

export const RewardedAdsUpdateable = RewardedAdsFillable;

@Entity()
export class RewardedAds {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    reward_type!: string;

    @Column()
    reward_value!: number;

    @Column()
    position!: string;

    @Column()
    is_active!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;
}
