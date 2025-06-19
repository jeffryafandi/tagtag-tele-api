import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { LuckyWheels } from "./lucky-wheels";
import { GameInventories } from "./game-inventories";
import { LuckyWheelSessions} from "./lucky-wheel-sessions";
import { LuckyWheelSessionPrizes } from "./lucky-wheel-session-prizes";

export const LuckyWheelPrizesFillable = [
    'lucky_wheel_id',
    'coupon_prize',
    'coin_prize',
    'game_inventory_id',
    'lucky_wheel_spin_entry_prize',
    'activity_point_prize'
];

export const LuckyWheelPrizesUpdateable = [
    'lucky_wheel_id',
    'coupon_prize',
    'coin_prize',
    'game_inventory_id',
    'lucky_wheel_spin_entry_prize',
    'activity_point_prize'
];

@Entity()
export class LuckyWheelPrizes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    lucky_wheel_id!: number;

    @Column()
    coupon_prize!: number;
   
    @Column()
    coin_prize!: number;
    
    @Column()
    game_inventory_id!: number;
   
    @Column()
    activity_point_prize!: number;
   
    @Column()
    lucky_wheel_spin_entry_prize!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => LuckyWheels, luckyWheels => luckyWheels.luckyWheelPrizes)
    @JoinColumn({
        name: "lucky_wheel_id"
    })
    luckyWheels!: LuckyWheels;
    
    @ManyToOne(type => GameInventories, gameInventory => gameInventory.luckyWheelPrizes)
    @JoinColumn({
        name: "game_inventory_id"
    })
    gameInventory!: GameInventories;
   
    @OneToMany(type => LuckyWheelSessionPrizes, luckyWheelSessionPrizes => luckyWheelSessionPrizes.luckyWheelPrizes)
    luckyWheelSessionPrizes!: LuckyWheelSessionPrizes[];
}