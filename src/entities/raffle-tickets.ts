import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { Raffles } from "./raffles";
import { Users } from "./users";

export const RaffleTicketFillable = [
    'name',
    'image_url',
    'description',
    'target_pools',
    'is_active',
    'is_completed'
];

export const RaffleTicketUpdateable = RaffleTicketFillable;

@Entity()
export class RaffleTickets {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int'})
    raffle_id!: number;
    
    @Column({type: 'int'})
    user_id!: number;
    
    @Column({type: 'int'})
    raffle_prize_id?: number;
    
    @Column({type: 'varchar'})
    ticket_no!: string;
    
    @Column({type: 'boolean', default: false})
    is_used!: boolean;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Raffles, raffles => raffles.raffleTickets)
    @JoinColumn({
        name: "raffle_id"
    })
    raffle?: Raffles

    @ManyToOne(type => Users, user => user.raffleTickets)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users
}