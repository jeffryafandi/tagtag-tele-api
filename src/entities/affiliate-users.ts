import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Affiliates } from "./affiliates";
import { Users } from "./users";

export const AffiliateUsersFillable = [
    'affiliate_id',
    'user_id'
];

export const AffiliateUsersUpdateable = [
    'affiliate_id',
    'user_id'
];

@Entity()
export class AffiliateUsers {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    affiliate_id!: number;

    @Column()
    user_id!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => Users, user => user.affiliateUsers)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;
   
    @ManyToOne(type => Affiliates, affiliates => affiliates.affiliateUsers)
    @JoinColumn({
        name: "affiliate_id"
    })
    affiliate?: Affiliates;
}