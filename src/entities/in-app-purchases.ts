import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { Users } from "./users";
import { type } from 'os';

export const InAppPurchaseFillable = [
    'user_id',
    'ext_product_id',
    'ext_token',
    'status',
    'price',
    'order_id',
    'iap_trx_id'
];

export const InAppPurchaseUpdateable = [
    'user_id',
    'ext_product_id',
    'ext_token',
    'status',
    'price',
    'order_id',
    'iap_trx_id'
];

export type InAppPurchaseSchema = {
    user_id         : number;
    ext_product_id  : string;
    ext_token       : string;
    status          : string; // @TODO: Change to enum
    price           : number;
    order_id        : string;
    iap_trx_id      : string;
}

export type InAppPurchaseSchemaGopay = {
    user_id         : number;
    ext_product_id  : string;
    ext_token       : string;
    status          : string; // @TODO: Change to enum
    price           : number;
    order_id        : string;
    type            : string;
}

export type InAppPurchaseCreatePayment = {
    ext_product_id  : string;
}

@Entity()
export class InAppPurchases {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;

    @Column({type: 'varchar', nullable: false})
    ext_product_id!: string;
    
    @Column({type: 'varchar', nullable: false})
    ext_token!: string;

    @Column({type: 'integer', nullable: false})
    price!: number;

    @Column()
    status!: string;

    @Column()
    order_id!: string;

    @Column()
    iap_trx_id!: string;

    @Column()
    type!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Users, user => user.inAppPurchases)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users
}