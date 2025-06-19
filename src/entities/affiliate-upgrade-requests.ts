import { type } from "os";
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { AffiliateBenefits } from "./affiliate-benefits";
import { Users } from "./users";
import { Affiliates } from "./affiliates";
import { AffiliateUpgradeRequestSocials } from "./affiliate-upgrade-request-socials";

export const AffiliateUpgradeRequestsFillable = [
   'affiliate_id',
   'name',
   'description',
   'phone_number',
   'email',
   'status',
   'previous_benefit_id',
];

export const AffiliateUpgradeRequestsUpdateable = [
   'affiliate_id',
   'name',
   'description',
   'phone_number',
   'email',
   'status',
   'previous_benefit_id',
];

@Entity()
export class AffiliateUpgradeRequests {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    affiliate_id!: number;
    
    @Column()
    previous_benefit_id!: number;

    @Column()
    name!: string;

    @Column()
    description!: string;

    @Column()
    phone_number!: string;

    @Column()
    email!: string;
    
    @Column()
    status!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => AffiliateUpgradeRequestSocials, affiliateUpgradeRequestSocials => affiliateUpgradeRequestSocials.affiliateUpgradeRequests)
    affiliateUpgradeRequestSocials?: AffiliateUpgradeRequestSocials[];

    @ManyToOne(type => Affiliates, affiliates => affiliates.affiliateUpgradeRequests)
    @JoinColumn({
        name: "affiliate_id"
    })
    affiliates?: Affiliates;

    @ManyToOne(type => AffiliateBenefits, affiliateBenefit => affiliateBenefit.affiliateUpgradeRequests)
    @JoinColumn({
        name: "previous_benefit_id"
    })
    affiliateBenefit!: AffiliateBenefits;
}