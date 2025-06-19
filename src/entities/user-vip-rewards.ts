import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";

export const UserVipRewardsFillable = [
    'user_id',
    'vip_reward_id',
    'claimed_at',
    'is_claimed'
];
  
export const UserVipRewardsUpdateable = [
    'user_id',
    'vip_reward_id',
    'claimed_at',
    'is_claimed'
];

@Entity()
export class UserVipRewards {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    vip_reward_id!: number;

    @Column()
    claimed_at!: string;

    @Column()
    is_claimed!: boolean;
}