import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
export const PrizepoolIncrementLogsFillable = [
    'prizepool_id',
    'user_id',
    'source',
    'increment_value'
];

export const PrizepoolIncrementLogsUpdateable = PrizepoolIncrementLogsFillable;

@Entity()
export class PrizepoolIncrementLogs {
    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column({type: 'int'})
    prizepool_id!: number;
    
    @Column({type: 'int'})
    user_id!: number;
    
    @Column({type: 'varchar'})
    source!: string;
   
    @Column({type: 'int'})
    source_id!: number;
    
    @Column({type: 'float'})
    increment_value!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
}