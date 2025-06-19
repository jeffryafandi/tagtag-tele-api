import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad, ManyToMany } from "typeorm";
import { FriendStatusEnum } from "../interfaces/requests/friend";
import { Users } from "./users";

export const UserActivityFillable = [
    'user_id',
    'logable_id',
    'logable_type',
    'type',
    'description'
];

export const UserActivityUpdateable = UserActivityFillable;
export enum UserActivityTypeEnum {
    activity    = 'activity',
    connection  = 'connection'
}
@Entity()
export class UserActivities {
    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column({type: 'int'})
    user_id!: number;
    
    @Column({type: 'int'})
    logable_id?: number;
    
    @Column({type: 'varchar'})
    logable_type?: string;

    @Column({type: 'enum', enum: UserActivityTypeEnum})
    type: UserActivityTypeEnum = UserActivityTypeEnum.connection;

    @Column({type: 'varchar'})
    description!: string;

    @Column("timestamp")
    created_at!: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Users, user => user.activities)
    @JoinColumn({
        name: 'user_id'
    })
    user!: Users;
}

