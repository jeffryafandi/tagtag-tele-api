import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";
import { Operators } from "./operators";

export const OperatorPurchaseFillable = [
    'user_id',
    'trx_id',
    'status',
    'operator_id',
    'account_number'
];

export const OperatorPurchaseUpdateable = OperatorPurchaseFillable;

@Entity()
export class OperatorPurchases {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('int')
    user_id!: number;

    @Column('varchar')
    trx_id!: string;

    @Column('int')
    operator_id!: number;

    @Column('varchar')
    account_number!: string;

    @Column('varchar')
    status!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @ManyToOne(type => Users, user => user.purchaseOperators)
    @JoinColumn({
        name: 'user_id'
    })
    user!: Users

    @ManyToOne(type => Operators, operator => operator.purchases)
    @JoinColumn({
        name: 'operator_id'
    })
    operator!: Operators
}