import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { UserRevenues } from "./user-revenues";

export const RevenueBaselinesFillable = [
    'cpm',
    'prize_pool_rate',
    'platform_rate',
    'start_date',
    'end_date',
    'is_published'
];

export const RevenueBaselinesUpdateable = [
    'cpm',
    'prize_pool_rate',
    'platform_rate',
    'start_date',
    'end_date',
    'is_published'
];

@Entity()
export class RevenueBaselines {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    cpm!: number;

    @Column()
    prize_pool_rate!: number;
    
    @Column({type: 'float'})
    platform_rate!: number;
    
    @Column("timestamp")
    start_date!: string
    
    @Column("timestamp")
    end_date!: string
    
    @Column()
    is_published!: boolean;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    // Relation
    @OneToMany(type => UserRevenues, userRevenue => userRevenue.revenueBaseline)
    userRevenues!: UserRevenues[];

}