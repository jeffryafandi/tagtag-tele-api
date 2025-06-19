import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";

export const VipRewardsFillable = [
    'name',
    'point_threshold',
    'reward_type',
    'point_prize',
    'prize_type',
    'prize_value'
];
  
export const VipRewardsUpdateable = [
    'name',
    'point_threshold',
    'reward_type',
    'point_prize',
    'prize_type',
    'prize_value'
];

@Entity()
export class VipRewards {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    point_threshold!: number;

    @Column()
    reward_type!: string;

    @Column()
    prize_type!: number;

    @Column()
    prize_value!: number;
}

