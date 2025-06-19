import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { OperatorPurchases } from "./operator-purchases";
import { PartnerAds } from "./partner-ads";

export const PartnersFillable = [
    'name',
    'website',
    'image_url'
];

export const PartnersUpdateable = PartnersFillable;

@Entity()
export class Partners {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'varchar'})
    name!: string;

    @Column({type: 'varchar'})
    image_url!: string;
   
    @Column({type: 'varchar'})
    website!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @OneToMany(type => PartnerAds, ads => ads.partner)
    ads!: PartnerAds[];
}

