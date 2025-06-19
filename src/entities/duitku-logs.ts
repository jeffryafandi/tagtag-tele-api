import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Users } from "./users";
import { UserWithdraws } from "./user-withdraws";

export const DuitkuLogsFillable = [
    'user_withdraw_id',
    'type',
    'json_response'
];
 
export const DuitkuLogsUpdateable = DuitkuLogsFillable;

@Entity()
export class DuitkuLogs {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_withdraw_id!: number;
    
    @Column({ type: 'varchar', length: 100 })
    type!: string
   
    @Column({ type: 'text' })
    json_response!: string

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

     //relations
    @ManyToOne(type => UserWithdraws, userWithdraw => userWithdraw.duitkuLogs)
    @JoinColumn({
        name: "user_withdraw_id"
    })
    userWithdraw!: UserWithdraws;
}
