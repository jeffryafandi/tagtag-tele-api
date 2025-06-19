import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

export const UserRequestsFillable = [
    'user_id',
    'endpoint',
    'server_ip'
];
 
export const UserRequestsUpdateable = UserRequestsFillable;

@Entity()
export class UserHackAttempts {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;
    
    @Column({ type: 'integer' })
    counter!: number;

    @Column({ type: 'varchar', length: 100 })
    attempt_key!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;
}
