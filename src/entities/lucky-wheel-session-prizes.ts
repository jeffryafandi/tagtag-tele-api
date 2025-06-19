import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { LuckyWheelPrizes } from "./lucky-wheel-prizes";
import { LuckyWheels } from "./lucky-wheels";
import { LuckyWheelSessions } from "./lucky-wheel-sessions";

export const LuckyWheelSessionPrizesFillable = [
   'lucky_wheel_session_id',
   'lucky_wheel_prize_id',
   'is_claimed'
];

export const LuckyWheelSessionPrizesUpdateable = [
   'lucky_wheel_session_id',
   'lucky_wheel_prize_id',
   'is_claimed'

];

@Entity()
export class LuckyWheelSessionPrizes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    lucky_wheel_session_id!: number;

    @Column()
    lucky_wheel_prize_id!: number;
    
    @Column()
    is_claimed!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => LuckyWheelSessions, luckyWheelSessions => luckyWheelSessions.luckyWheelSessionPrizes)
    @JoinColumn({
        name: "lucky_wheel_session_id"
    })
    luckyWheelSessions!: LuckyWheelSessions;
    
    @ManyToOne(type => LuckyWheelPrizes, luckyWheelPrizes => luckyWheelPrizes.luckyWheelSessionPrizes)
    @JoinColumn({
        name: "lucky_wheel_prize_id"
    })
    luckyWheelPrizes!: LuckyWheelPrizes;
}