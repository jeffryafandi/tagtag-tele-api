import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { InAppProducts } from "./in-app-products";

export const InAppProductContentFillable = [
    'in_app_product_id',
    'coupon',
    'coin',
    'game_inventory_id',
    'free_ads',
    'game_inventory_duration',
    'game_inventory_quantity'
];

export const InAppProductContentUpdateable = [
    'in_app_product_id',
    'coupon',
    'coin',
    'game_inventory_id',
    'free_ads',
    'game_inventory_duration',
    'game_inventory_quantity'
];

@Entity()
export class InAppProductContents {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'bigint', nullable: false})
    in_app_product_id!: number;

    @Column({type: 'int'})
    coupon?: number;
    
    @Column({type: 'int'})
    coin?: number;

    @Column({type: 'int'})
    game_inventory_id?: number;

    @Column({type: 'int'})
    free_ads?: number;

    @Column({type: 'int'})
    game_inventory_duration?: number;

    @Column({type: 'int'})
    game_inventory_quantity?: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @OneToOne(type => InAppProducts, product => product.content)
    @JoinColumn({
        name: "in_app_product_id"
    })
    product?: InAppProducts
}