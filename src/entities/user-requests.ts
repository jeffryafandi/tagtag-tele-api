import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

export const UserRequestsFillable = [
    'user_id',
    'endpoint',
    'server_ip'
];
 
export const UserRequestsUpdateable = UserRequestsFillable;

@Entity()
export class UserRequests {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;
    
    @Column({ type: 'varchar', length: 255 })
    endpoint!: string;

    @Column({ type: 'varchar', length: 100 })
    server_ip!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
}
