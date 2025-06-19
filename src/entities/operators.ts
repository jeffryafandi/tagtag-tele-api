import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { UserExtPrizes } from "./user-ext-prizes";
import { RafflePrizes } from "./raffle-prizes";
import { ExtPrizes } from "./ext-prizes";
import { OperatorPurchases } from "./operator-purchases";

export const OperatorsFillable = [
    'name',
    'code',
    'description',
    'type',
    'denom',
    'price',
    'vendor'
];

export const OperatorsUpdateable = OperatorsFillable;

@Entity()
export class Operators {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar'})
    code!: string;
    
    @Column({type: 'varchar'})
    name!: string;

    @Column({type: 'varchar'})
    description!: string;
   
    @Column({type: 'varchar'})
    group_name!: string;

    @Column({type: 'varchar'})
    type!: string;
    
    @Column({type: 'int'})
    denom!: number;
    
    @Column({type: 'int'})
    price!: number;

    @Column({type: 'varchar'})
    vendor!: string;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @OneToMany(type => ExtPrizes, extPrizes => extPrizes.operators)
    extPrizes!: ExtPrizes[];

    @OneToMany(type => OperatorPurchases, operatorPurchase => operatorPurchase.operator)
    purchases!: OperatorPurchases[];
}

