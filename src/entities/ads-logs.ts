import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Users } from "./users";

export const AdsLogsFillable = [
    'user_id',
    'type',
    'source_type',
    'source_code',
    'status'
];
 
export const AdsLogsUpdateable = [
    'user_id',
    'type',
    'source_type',
    'source_code',
    'status'
];

@Entity()
export class AdsLogs {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;
    
    @Column({ type: 'varchar', length: 100 })
    type?: string
   
    @Column({ type: 'varchar', length: 100 })
    status?: string

    @Column({ type: 'varchar', length: 100 })
    source_type?: string

    @Column({ type: 'varchar', length: 100 })
    source_code?: string

    @Column({ type: 'varchar', length: 100 })
    logable_type?: string

    @Column({ type: 'int' })
    logable_id?: number

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    /** RELATIONS */
    @ManyToOne(type => Users, user => user.adsLogs)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;
}
