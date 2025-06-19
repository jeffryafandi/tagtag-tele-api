import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { UserMissions } from "./user-missions";
import { Games } from "./games";

export const MissionsFillable = [
  'game_id',
  'code',
  'description',
  'value',
  'value_scaling',
  'coupon_prize',
  'coupon_prize_scaling',
  'max_coupon_prize',
  'coin_prize',
  'coin_prize_web',
  'stamina_prize',
  'total_stages',
  'complete_coin_prize'
];

export const MissionsUpdateable = [
  'game_id',
  'code',
  'description',
  'value',
  'value_scaling',
  'coupon_prize',
  'coupon_prize_scaling',
  'max_coupon_prize',
  'coin_prize',
  'coin_prize_web',
  'stamina_prize',
  'total_stages',
  'complete_coin_prize'
];

@Entity()
export class Missions {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    game_id!: number;

    @Column()
    code!: string;
   
    @Column()
    description!: string;

    @Column()
    value!: number;

    @Column({type: 'float'})
    value_scaling!: number;
   
    @Column()
    coupon_prize!: number;
   
    @Column({type: 'float'})
    coupon_prize_scaling!: number;
   
    @Column()
    activity_point_prize!: number;
   
    @Column({type: 'float'})
    activity_point_prize_scaling!: number;
    
    @Column()
    max_coupon_prize!: number;

    @Column()
    stamina_prize!: number;

    @Column()
    coin_prize!: number;

    @Column()
    coin_prize_web!: number;

    @Column()
    total_stages!: number;

    @Column()
    complete_coin_prize!: number;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => Games, game => game.missions)
    @JoinColumn({
        name: "game_id"
    })
    game?: Games;

    @OneToMany(type => UserMissions, userMissions => userMissions.missions)
    userMissions?: UserMissions[];

}