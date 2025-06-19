import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad, ManyToMany } from "typeorm";
import { FriendStatusEnum } from "../interfaces/requests/friend";
import { Users } from "./users";

export const UserFriendFillable = [
    'user_id',
    'friended_id',
    'status'
];

export const UserFriendUpdateable = UserFriendFillable;

@Entity()
export class UserFriends {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: 'int'})
    friended_id!: number;
    
    @Column({type: 'int'})
    user_id!: number;
   
    @Column({type: 'varchar'})
    status!: FriendStatusEnum;

    @Column("timestamp")
    created_at!: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Users, user => user.userFriends)
    @JoinColumn({
        name: 'user_id'
    })
    owner!: Users;

    @ManyToOne(type => Users, user => user.friends)
    @JoinColumn({
        name: 'friended_id'
    })
    friendDetail!: Users;
}

