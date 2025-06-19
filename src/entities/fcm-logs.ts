import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Users } from "./users";

export const FCMLogsFillable = [
];
 
export const FCMLogsUpdateable = FCMLogsFillable;

@Entity()
export class FCMLogs {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    payload!: string;
    
    @Column({ type: 'text' })
    data!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
}
