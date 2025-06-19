import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Missions } from "./missions";
import { Users } from "./users";

export const UserMissionsFillable = [
   'user_id',
   'mission_id',
   'target_value',
   'current_value',
   'coupon_prize',
   'activity_point_prize',
   'coin_prize',
   'stamina_prize',
   'is_claimed',
   'is_complete',
   'complete_prize_claimed',
   'session_code',
   'started_at'
];

export const UserMissionsUpdateable = [
   'user_id',
   'mission_id',
   'target_value',
   'current_value',
   'coupon_prize',
   'activity_point_prize',
   'coin_prize',
   'stamina_prize',
   'is_claimed',
   'is_complete',
   'complete_prize_claimed',
   'session_code',
   'started_at'
];

@Entity()
export class UserMissions {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    mission_id!: number;
   
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

    @Column()
    complete_prize_claimed!: boolean;

    @Column()
    session_code!: string;

    @Column("timestamp")
    started_at?: string;
   
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @Column()
    is_reset!: boolean;
    
    // Relations
    @ManyToOne(type => Users, user => user.userMissions)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;
   
    @ManyToOne(type => Missions, missions => missions.userMissions)
    @JoinColumn({
        name: "mission_id"
    })
    missions?: Missions;

}