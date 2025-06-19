import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { OperatorPurchases } from "./operator-purchases";
import { Partners } from "./partners";

export const PartnerAdsFillable = [
    'partner_id',
    'type',
    'video_url',
    'min_watch_time'
];

export const PartnerAdsUpdateable = PartnerAdsFillable;

@Entity()
export class PartnerAds {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int'})
    partner_id!: number;

    @Column({type: 'varchar'})
    type!: string;
   
    @Column({type: 'varchar'})
    media_url!: string;

    @Column({type: 'varchar'})
    media_type!: string;

    @Column({type: 'int'})
    duration!: number;
    
    @Column({type: 'int'})
    min_watch_time!: number;

    @Column({type: 'varchar'})
    action_link?: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Partners, partner => partner.ads)
    @JoinColumn({
        name: "partner_id"
    })
    partner?: Partners;
}

