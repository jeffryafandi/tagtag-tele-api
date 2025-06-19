import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { UserQuests } from "./user-quests";
import { Games } from "./games";

export const QuestsFillable = [
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
];

export const QuestsUpdateable = [
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
];

@Entity()
export class Quests {
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
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => Games, game => game.quests)
    @JoinColumn({
        name: "game_id"
    })
    game?: Games;

    @OneToMany(type => UserQuests, userQuests => userQuests.quest)
    userQuests?: UserQuests[];

}