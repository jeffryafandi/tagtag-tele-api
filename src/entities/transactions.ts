import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";
import { TransactionDetails } from "./transaction-details";

export const TransactionsFillable = [
   'user_id',
   'description',
   'code',
   'extras'
];

export const TransactionsUpdateable = TransactionsFillable;

@Entity()
export class Transactions {
   @PrimaryGeneratedColumn()
   id!: number;

   @Column()
   user_id!: number;

   @Column()
   description!: string;
   
   @Column()
   code!: string;
   
   @Column({type: 'text'})
   extras!: string;

   @Column("timestamp")
   created_at?: string;

   @Column("timestamp")
   updated_at?: string;

   @Column("timestamp")
   deleted_at?: string;
   
   // Relations
   @OneToMany(type => TransactionDetails, details => details.transaction)
   details!: TransactionDetails[];

   @ManyToOne(type => Users, user => user.transactions)
   @JoinColumn({
       name: "user_id"
   })
   user!: Users;
}