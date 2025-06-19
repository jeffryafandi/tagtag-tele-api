import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { RaffleTickets } from "./raffle-tickets";
import { RafflePrizes } from "./raffle-prizes";
import { RaffleParticipations } from "./raffle-participations";

export const RaffleFillable = [
    'name',
    'image_url',
    'description',
    'target_pools',
    'inserted_coupons',
    'is_active',
    'is_completed'
];

export const RaffleUpdateable = RaffleFillable;

@Entity()
export class Raffles {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar'})
    name!: string;
    
    @Column({type: 'varchar'})
    image_url!: string;
    
    @Column({type: 'varchar'})
    description!: string;
    
    @Column({type: 'int'})
    target_pools!: number;

    @Column({type: 'int'})
    inserted_coupons!: number;
    
    @Column({type: 'boolean'})
    is_active!: boolean;
    
    @Column({type: 'boolean'})
    is_completed!: boolean;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @OneToMany(type => RaffleTickets, raffleTickets => raffleTickets.raffle)
    raffleTickets!: RaffleTickets[];

    @OneToMany(type => RaffleParticipations, raffleParticipations => raffleParticipations.raffle)
    participations!: RaffleParticipations[];

    @OneToMany(type => RafflePrizes, rafflePrizes => rafflePrizes.raffle)
    rafflePrizes!: RafflePrizes[];
}