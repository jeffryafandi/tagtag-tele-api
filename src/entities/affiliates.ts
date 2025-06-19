import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { AffiliateBenefits } from "./affiliate-benefits";
import { AffiliateSocials } from "./affiliate-socials";
import { AffiliateUsers } from "./affiliate-users";
import { Users } from "./users";
import { AffiliateUpgradeRequests } from "./affiliate-upgrade-requests";

export const AffiliatesFillable = [
   'user_id',
   'type',
   'name',
   'description',
   'link',
   'pic',
   'phone_number',
   'email',
   'affiliate_benefit_id',
   'status',
   'remarks'
];

export const AffiliatesUpdateable = [
   'user_id',
   'type',
   'name',
   'description',
   'link',
   'pic',
   'phone_number',
   'email',
   'affiliate_benefit_id',
   'status',
   'remarks'
];

@Entity()
export class Affiliates {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    type!: string;

    @Column()
    name!: string;

    @Column()
    description!: string;

    @Column()
    link!: string;

    @Column()
    pic!: string;

    @Column()
    phone_number!: string;

    @Column()
    email!: string;
    
    @Column()
    affiliate_benefit_id!: number;
    
    @Column()
    status!: string;
    
    @Column()
    remarks!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => AffiliateUsers, affiliateUsers => affiliateUsers.affiliate)
    affiliateUsers!: AffiliateUsers[];
    
    @OneToMany(type => AffiliateSocials, affiliateSocials => affiliateSocials.affiliate)
    affiliateSocials?: AffiliateSocials[];
    
    @OneToMany(type => AffiliateUpgradeRequests, affiliateUpgradeRequest => affiliateUpgradeRequest.affiliates)
    affiliateUpgradeRequests?: AffiliateUpgradeRequests[];
    
    @OneToOne(type => Users, user => user.affiliate)
    @JoinColumn({
        name: "user_id"
    })
    user!: Users;
   
    @ManyToOne(type => AffiliateBenefits, affiliateBenefit => affiliateBenefit.affiliates)
    @JoinColumn({
        name: "affiliate_benefit_id"
    })
    affiliateBenefit!: AffiliateBenefits;
}