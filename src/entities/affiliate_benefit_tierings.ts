import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { AffiliateBenefits } from "./affiliate-benefits";

export const AffiliateBenefitTieringsFillable = [
   'affiliate_benefit_id',
   'threshold',
   'value'

];

export const AffiliateBenefitTieringsUpdateable = [
   'affiliate_benefit_id',
   'threshold',
   'value'

];

@Entity()
export class AffiliateBenefitTierings {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    affiliate_benefit_id!: number;

    @Column()
    threshold!: number;
   
    @Column({type: 'decimal', precision: 10, scale: 2, default: 0})
    value!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => AffiliateBenefits, affiliateBenefits => affiliateBenefits.affiliateBenefitTierings)
    @JoinColumn({
        name: "affiliate_benefit_id"
    })
    affiliateBenefit?: AffiliateBenefits;
}