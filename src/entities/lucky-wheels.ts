import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { LuckyWheelSessions} from "./lucky-wheel-sessions";
import { LuckyWheelPrizes } from "./lucky-wheel-prizes";

export const LuckyWheelsFillable = [
    'name',
    'is_active'
];

export const LuckyWheelsUpdateable = [
    'name',
    'is_active'
];

@Entity()
export class LuckyWheels {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    is_active!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => LuckyWheelSessions, luckyWheelSessions => luckyWheelSessions.luckyWheels)
    luckyWheelSessions?: LuckyWheelSessions[];
    
    @OneToMany(type => LuckyWheelPrizes, luckyWheelPrizes => luckyWheelPrizes.luckyWheels)
    luckyWheelPrizes?: LuckyWheelPrizes[];
}