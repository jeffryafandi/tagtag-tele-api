import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Users } from "./users";

export const UserPinsFillable = [
    'user_id',
    'pin',
    'request_pin_token',
    'token_expired_at',
    'is_verified'
];
 
export const UserPinsUpdateable = UserPinsFillable;

@Entity()
export class UserPins {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;

    @Column({ type: 'varchar' })
    pin!: string;

    @Column({ type: 'tinyint' })
    is_verified!: boolean;

    @Column({ type: 'varchar' })
    request_pin_token?: string|null;
    
    @Column({ type: 'timestamp' })
    token_expired_at?: string|null;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @ManyToOne(type => Users, user => user.userPin)
    @JoinColumn({
        name: 'user_id'
    })
    user!: Users;
}
