import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
export const PrizepoolsFillable = [
    'name',
    'start_date',
    'end_date',
    'is_active',
];

export const PrizepoolsUpdateable = PrizepoolsFillable;

@Entity()
export class VipPrizepools {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar'})
    name!: string;

    @Column({type: 'datetime'})
    start_date!: string;
    
    @Column({type: 'datetime'})
    end_date!: string;
    
    @Column({type: 'boolean'})
    is_active!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
}