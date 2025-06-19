import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";
import { Banks } from "./banks";

export const BankFillable = [
    'user_id',
    'bank_id',
    'account_name',
    'account_number'
];

export const BankUpdateable = BankFillable;

@Entity()
export class UserBanks {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "int"})
    user_id!: number;

    @Column({type: "int"})
    bank_id!: number;

    @Column({type: "varchar"})
    account_name?: string;
    
    @Column({type: "varchar"})
    account_number!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @ManyToOne(type => Users, user => user.userBanks)
    @JoinColumn({name: 'user_id'})
    user!: Users

    @ManyToOne(type => Banks)
    @JoinColumn({name: 'bank_id'})
    bank!: Banks
}