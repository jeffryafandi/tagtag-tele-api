import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Affiliates } from "./affiliates";
import { AffiliateBenefitTierings } from "./affiliate_benefit_tierings";
import { AffiliateUpgradeRequests } from "./affiliate-upgrade-requests";

export const AffiliateBenefitsFillable = [
   'type',
   'commission_type',
   'name',
   'description',
   'value'
];

export const AffiliateBenefitsUpdateable = [
   'type',
   'commission_type',
   'name',
   'description',
   'value'
];

export type benefitAvailableFilter = {
   type           ?: string;
   commission_type?: string;
   name           ?: string
}

@Entity()
export class AffiliateBenefits {
   @PrimaryGeneratedColumn()
   id!: number;

   @Column()
   type!: string;

   @Column()
   description!: string;

   @Column()
   commission_type!: string;
   
   @Column()
   name!: string;
   
   @Column({type: 'decimal', precision: 10, scale: 2, default: 0})
   value!: number;

   @Column("timestamp")
   created_at?: string;

   @Column("timestamp")
   updated_at?: string;

   @Column("timestamp")
   deleted_at?: string;
   
   // Relations
   @OneToMany(type => Affiliates, affiliates => affiliates.affiliateBenefit)
   affiliates!: Affiliates[];

   @OneToMany(type => AffiliateBenefitTierings, affiliateBenefitTierings => affiliateBenefitTierings.affiliateBenefit)
   affiliateBenefitTierings!: AffiliateBenefitTierings[];
   
   @OneToMany(type => AffiliateUpgradeRequests, affiliateUpgradeRequests => affiliateUpgradeRequests.affiliateBenefit)
   affiliateUpgradeRequests!: AffiliateUpgradeRequests[];
}