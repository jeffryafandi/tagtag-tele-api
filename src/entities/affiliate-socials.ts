import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Affiliates } from "./affiliates";

export const AffiliateSocialsFillable = [
    'affiliate_id',
    'type',
    'link'
];

export const AffiliateSocialsUpdateable = [
    'affiliate_id',
    'type',
    'link'
];

@Entity()
export class AffiliateSocials {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    affiliate_id!: number;

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
    @ManyToOne(type => Affiliates, affiliates => affiliates.affiliateSocials)
    @JoinColumn({
        name: "affiliate_id"
    })
    affiliate?: Affiliates;
}