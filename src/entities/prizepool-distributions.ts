import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Prizepools } from "./prizepools";
import { Users } from "./users";
export const PrizepoolDistributionsFillable = [
    'prizepool_id',
    'prizepool_daily_percentage_id',
    'user_id',
    'type',
    'value'
];

export const PrizepoolDistributionsUpdateable = PrizepoolDistributionsFillable;

@Entity()
export class PrizepoolDistributions {
    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column({type: 'int'})
    prizepool_id!: number;

    @Column({type: 'int'})
    prizepool_daily_percentage_id?: number;
    
    @Column({type: 'int'})
    user_id!: number;

    @Column({type: 'int'})
    position!: number;
    
    @Column({type: 'varchar'})
    type!: 'weekly' | 'daily';
    
    @Column({type: 'int'})
    value!: number;

    @Column("timestamp")
    created_at!: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Prizepools, prizepool => prizepool.distributions)
    @JoinColumn({
        name: 'prizepool_id'
    })
    prizepool?: Prizepools

    @ManyToOne(type => Users)
    @JoinColumn({
        name: 'user_id'
    })
    user?: Users
}