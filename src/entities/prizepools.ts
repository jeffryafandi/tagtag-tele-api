import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { PrizepoolDailyPercentages } from "./prizepool-daily-percentages";
import { PrizepoolDistributions } from "./prizepool-distributions";
export const PrizepoolsFillable = [
    'name',
    'total_pools',
    'start_date',
    'end_date',
    'increment_value_ads_interstitial',
    'increment_value_ads_rewarded',
    'value_per_purchase',
    'daily_distributions',
    'weekly_distributions',
    'is_active',
];

export const PrizepoolsUpdateable = PrizepoolsFillable;

@Entity()
export class Prizepools {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar'})
    name!: string;
    
    @Column({type: 'int'})
    total_pools!: number;

    @Column({type: 'datetime'})
    start_date!: string;
    
    @Column({type: 'datetime'})
    end_date!: string;
    
    @Column({type: 'float'})
    increment_value_ads_rewarded!: number;

    @Column({type: 'float'})
    increment_value_ads_interstitial!: number;
    
    @Column({type: 'float'})
    value_per_purchase!: number;
    
    @Column({type: 'varchar'})
    daily_distributions!: string;
    
    @Column({type: 'varchar'})
    weekly_distributions!: string;
    
    @Column({type: 'boolean'})
    is_active!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    // Relations
    @OneToMany(type => PrizepoolDailyPercentages, dailyPercentages => dailyPercentages.prizepool)
    dailyPercentages!: PrizepoolDailyPercentages[];

    @OneToMany(type => PrizepoolDistributions, distribution => distribution.prizepool)
    distributions!: PrizepoolDistributions[];
}