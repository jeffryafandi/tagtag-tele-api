import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Affiliates } from "./affiliates";
import { AffiliateUpgradeRequests } from "./affiliate-upgrade-requests";

export const AffiliateUpgradeRequestSocialsFillable = [
    'affiliate_upgrade_request_id',
    'type',
    'link'
];

export const AffiliateUpgradeRequestSocialsUpdateable = [
    'affiliate_upgrade_request_id',
    'type',
    'link'
];

@Entity()
export class AffiliateUpgradeRequestSocials {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    affiliate_upgrade_request_id!: number;

    @Column()
    type!: string;
    
    @Column()
    link!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => AffiliateUpgradeRequests, affiliateUpgradeRequests => affiliateUpgradeRequests.affiliateUpgradeRequestSocials)
    @JoinColumn({
        name: "affiliate_upgrade_request_id"
    })
    affiliateUpgradeRequests?: AffiliateUpgradeRequests;
}