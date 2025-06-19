import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";
import { Transactions } from "./transactions";

export const TransactionDetailsFillable = [
   'transaction_id',
   'value',
   'type',
   'currency',
   'previous_value',
   'current_value'
];

export const TransactionDetailsUpdateable = TransactionDetailsFillable;

@Entity()
export class TransactionDetails {
   @PrimaryGeneratedColumn()
   id!: number;

   @Column()
   transaction_id!: number;

   @Column()
   type!: string;
   
   @Column({type: 'float'})
   value!: number;

   @Column({type: 'float'})
   previous_value!: number;

   @Column({type: 'float'})
   current_value!: number;
   
   @Column()
   currency!: string;

   @Column("timestamp")
   created_at?: string;

   @Column("timestamp")
   updated_at?: string;

   @Column("timestamp")
   deleted_at?: string;
   
   // Relations

   @ManyToOne(type => Transactions, transaction => transaction.details)
   @JoinColumn({
       name: "transaction_id"
   })
   transaction!: Transactions;
}