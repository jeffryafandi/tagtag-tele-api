import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Quests } from "./quests";
import { Users } from "./users";

export const UserQuestsFillable = [
  'user_id',
  'quest_id',
  'target_value',
  'current_value',
  'coupon_prize',
  'activity_point_prize',
  'coin_prize',
  'stamina_prize',
  'is_watched_ad',
  'is_claimed',
  'is_completed',
  'started_at'
];

export const UserQuestsUpdateable = [
  'user_id',
  'quest_id',
  'target_value',
  'current_value',
  'coupon_prize',
  'activity_point_prize',
  'coin_prize',
  'stamina_prize',
  'is_watched_ad',
  'is_claimed',
  'is_completed',
  'started_at'
];

@Entity()
export class UserQuests {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    quest_id!: number;
   
    @Column()
    target_value!: number;

    @Column()
    current_value!: number;
    
    @Column()
    coupon_prize!: number;
    
    @Column()
    activity_point_prize!: number;

    @Column()
    coin_prize!: number;

    @Column()
    stamina_prize!: number;

    @Column()
    is_claimed!: boolean;
   
    @Column()
    is_completed!: boolean;

    @Column()
    is_watched_ad!: boolean;

    @Column("timestamp")
    started_at?: string;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => Users, user => user.userQuests)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;
   
    @ManyToOne(type => Quests, quests => quests.userQuests)
    @JoinColumn({
        name: "quest_id"
    })
    quest?: Quests;

}