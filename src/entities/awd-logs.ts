import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Users } from "./users";

export const AwdLogsFillable = [
    'logable_tab_id',
    'logable_tab',
    'type',
    'json_response'
];
 
export const AwdLogsUpdateable = AwdLogsFillable;

@Entity()
export class AwdLogs {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    logable_tab_id!: number;

    @Column({ type: 'varchar', nullable: false})
    logable_tab!: string;
    
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
}
