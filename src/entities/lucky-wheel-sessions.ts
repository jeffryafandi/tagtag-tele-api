import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { LuckyWheelPrizes } from "./lucky-wheel-prizes";
import { LuckyWheels } from "./lucky-wheels";
import { LuckyWheelSessionPrizes } from "./lucky-wheel-session-prizes";
import { Users } from "./users";

export const LuckyWheelSessionsFillable = [
   'user_id',
   'lucky_wheel_id',
   'is_completed'
];

export const LuckyWheelSessionsUpdateable = [
   'user_id',
   'lucky_wheel_id',
   'is_completed'
];

@Entity()
export class LuckyWheelSessions {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    lucky_wheel_id!: number;
   
    @Column()
    is_completed!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => LuckyWheelSessionPrizes, luckyWheelSessionPrizes => luckyWheelSessionPrizes.luckyWheelSessions)
    luckyWheelSessionPrizes?: LuckyWheelSessionPrizes[];

    @ManyToOne(type => LuckyWheels, luckyWheels => luckyWheels.luckyWheelSessions)
    @JoinColumn({
        name: "lucky_wheel_id"
    })
    luckyWheels?: LuckyWheels;

    @ManyToOne(type => Users, user => user.luckyWheelSessions)
    @JoinColumn({
        name: "user_id"
    })
    user!: Users;
}