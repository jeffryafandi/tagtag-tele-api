import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { UserWithdraws } from "./user-withdraws";

export const MidtransPayoutLogsFillable = [
    'user_withdraw_id',
    'type',
    'json_request',
    'json_response'
];
 
export const MidtransPayoutLogsUpdateable = MidtransPayoutLogsFillable;

@Entity()
export class MidtransPayoutLogs {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_withdraw_id!: number;
    
    @Column({ type: 'varchar', length: 100 })
    type!: string

    @Column({ type: 'varchar', length: 20 })
    reference_no!: string

    @Column({ type: 'text' })
    json_request!: string
   
    @Column({ type: 'text' })
    json_response!: string

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

     //relations
    @ManyToOne(type => UserWithdraws, userWithdraw => userWithdraw.midtransPayoutLogs)
    @JoinColumn({
        name: "user_withdraw_id"
    })
    userWithdraw!: UserWithdraws;
}
