import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { Raffles } from "./raffles";
import { ExtPrizes } from "./ext-prizes";
import { GameInventories } from "./game-inventories";

export const RaffleFillable = [
    'name',
    'image_url',
    'description',
    'target_pools',
    'is_active',
    'is_completed',
    'activity_point_prize'
];

export const RaffleUpdateable = RaffleFillable;

@Entity()
export class RafflePrizes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int'})
    raffle_id!: number;
    
    @Column({type: 'varchar'})
    name!: string;

    @Column({type: 'varchar'})
    image_url!: string;
    
    @Column({type: 'varchar'})
    description!: string;
    
    @Column({type: 'int'})
    coupon_prize!: number;
    
    @Column({type: 'int'})
    coin_prize!: number;
    
    @Column({type: 'int'})
    activity_point_prize!: number;
    
    @Column({type: 'int'})
    game_inventory_id!: number;
    
    @Column({type: 'int'})
    ext_prize_id!: number;
    
    @Column({type: 'int'})
    prize_order!: number;

    @Column({type: 'boolean'})
    is_claimed!: boolean;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Raffles, raffles => raffles.rafflePrizes)
    @JoinColumn({
        name: "raffle_id"
    })
    raffle?: Raffles
    
    @ManyToOne(type => ExtPrizes, extPrizes => extPrizes.rafflePrizes)
    @JoinColumn({
        name: "ext_prize_id"
    })
    extPrizes?: ExtPrizes
   
    @ManyToOne(type => GameInventories, gameInventorie => gameInventorie.rafflePrize)
    @JoinColumn({
        name: "game_inventory_id"
    })
    gameInventory?: GameInventories
}