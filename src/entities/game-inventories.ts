import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { UserGameInventories } from "./user-game-inventories";
import { LuckyWheelPrizes } from "./lucky-wheel-prizes";
import { RafflePrizes } from "./raffle-prizes";

export const GameInventoriesFillable = [
   'code',
   'name',
];

export const GameInventoriesUpdateable = [
   'code',
   'name',
];

@Entity()
export class GameInventories {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    code!: string;

    @Column()
    name!: string;

    @Column('tinyint')
    can_expired!: boolean;

    @Column('float')
    value!: number;

    @Column()
    type!: string;
   
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => UserGameInventories, userGameInventories => userGameInventories.gameInventory)
    userGameInventories?: UserGameInventories[];

    @OneToMany(type => LuckyWheelPrizes, luckyWheelPrize => luckyWheelPrize.gameInventory)
    luckyWheelPrizes?: LuckyWheelPrizes[];
    
    @OneToMany(type => RafflePrizes, rafflePrize => rafflePrize.gameInventory)
    rafflePrize?: RafflePrizes[];
}