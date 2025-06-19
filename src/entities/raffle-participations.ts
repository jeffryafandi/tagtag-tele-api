import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { Raffles } from "./raffles";
import { Users } from "./users";

export const RaffleParticipationFillable = [
    'name',
    'image_url',
    'description',
    'target_pools',
    'is_active',
    'is_completed'
];

export const RaffleParticipationUpdateable = RaffleParticipationFillable;

@Entity()
export class RaffleParticipations {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int'})
    raffle_id!: number;
    
    @Column({type: 'int'})
    user_id!: number;
    
    @Column({type: 'int'})
    inserted_coupons!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Raffles, raffles => raffles.participations)
    @JoinColumn({
        name: "raffle_id"
    })
    raffle?: Raffles

    @ManyToOne(type => Users, user => user.participations)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users
}