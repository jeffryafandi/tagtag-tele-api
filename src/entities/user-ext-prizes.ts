import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { ExtPrizes } from "./ext-prizes";

export const UserExtPrizeFillable = [
    'name',
    'image_url',
    'description',
    'target_pools',
    'is_active',
    'is_completed'
];

export const UserExtPrizeUpdateable = UserExtPrizeFillable;

@Entity()
export class UserExtPrizes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int'})
    ext_prize_id!: number;
    
    @Column({type: 'int'})
    user_id!: number;
   
    @Column({type: 'boolean'})
    is_claimed!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => ExtPrizes, extPrizes => extPrizes.userExtPrizes)
    @JoinColumn({
        name: "ext_prize_id"
    })
    extPrizes!: ExtPrizes
}

