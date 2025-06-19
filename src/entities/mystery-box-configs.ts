import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";

export const MysteryBoxConfigFillable = [
    'start_date',
    'end_date',
    'total_prize',
    'daily_distributions',
    'daily_limit_winners'
];

export const MysteryBoxConfigUpdateable = MysteryBoxConfigFillable;

@Entity()
export class MysteryBoxConfigs {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("datetime")
    start_date!: string;
    
    @Column("datetime")
    end_date!: string;

    @Column("int")
    total_prize!: number;

    @Column("text")
    daily_distributions!: string;

    @Column("int")
    daily_limit_winners!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;
}