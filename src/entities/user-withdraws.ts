import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Users } from "./users";
import { DuitkuLogs } from "./duitku-logs";
import { MidtransPayoutLogs } from "./midtrans-payout-logs";

export const UserWithdrawsFillable = [
    'user_id',
    'type',
    'source_type',
    'source_code',
    'status'
];
 
export const UserWithdrawsUpdateable = UserWithdrawsFillable;

@Entity()
export class UserWithdraws {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;
    
    @Column({ type: 'int' })
    withdraw_amount!: number
   
    @Column({ type: 'varchar', length: 100 })
    status!: string

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    //relations 
    @OneToMany(type => DuitkuLogs, duitkuLogs => duitkuLogs.userWithdraw)
    duitkuLogs?: DuitkuLogs[];

    //relations 
    @OneToMany(type => MidtransPayoutLogs, midtransPayoutLogs => midtransPayoutLogs.userWithdraw)
    midtransPayoutLogs?: MidtransPayoutLogs[];

    @ManyToOne(type => Users, user => user.userWithdraws)
    @JoinColumn({
        name: "user_id"
    })
    user!: Users;
}
