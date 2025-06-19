import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Prizepools } from "./prizepools";
export const PrizepoolDailyPercentagesFillable = [
    'prizepool_id',
    'date',
    'percentage',
    'increment_value_ads_interstitial',
    'increment_value_ads_rewarded'
];

export const PrizepoolDailyPercentagesUpdateable = PrizepoolDailyPercentagesFillable;

@Entity()
export class PrizepoolDailyPercentages {
    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column({type: 'int'})
    prizepool_id!: number;
    
    @Column({type: 'date'})
    date!: string;
    
    @Column({type: 'float'})
    percentage!: number;

    @Column({type: 'float'})
    increment_value_ads_rewarded!: number;

    @Column({type: 'float'})
    increment_value_ads_interstitial!: number;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Prizepools, prizepool => prizepool.dailyPercentages)
    @JoinColumn({
        name: "prizepool_id"
    })
    prizepool!: Prizepools;
}