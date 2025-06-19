import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";
import { RevenueBaselines } from "./revenue-baselines";

export const UserRevenuesFillable = [
    'user_id',
    'revenue_baseline_id',
    'total_ads_revenue',
    'total_purchase_revenue',
    'total_withdrawable_purchase',
    'total_withdrawable_ads'
];

export const UserRevenuesUpdateable = [
    'user_id',
    'revenue_baseline_id',
    'total_ads_revenue',
    'total_purchase_revenue',
    'total_withdrawable_purchase',
    'total_withdrawable_ads'
];

@Entity()
export class UserRevenues {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    revenue_baseline_id!: number;
    
    @Column({type: 'float'})
    total_ads_revenue!: number;

    @Column({type: 'float'})
    total_purchase_revenue!: number;

    @Column({type: 'float'})
    total_withdrawable_ads!: number;

    @Column({type: 'float'})
    total_withdrawable_purchase!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    // Relation
    @ManyToOne(type => Users, user => user.userRevenues)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;

    @ManyToOne(type => RevenueBaselines, baseline => baseline.userRevenues)
    @JoinColumn({
        name: 'revenue_baseline_id'
    })
    revenueBaseline!: RevenueBaselines;
}