import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";

export const UserDeviceFillable = [
    'user_id',
    'app_type',
    'version',
    'token'
];

export const UserDeviceUpdateable = UserDeviceFillable;

@Entity()
export class UserDevices {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "int"})
    user_id!: number;

    @Column({type: "varchar"})
    app_type?: string;
    
    @Column({type: "varchar"})
    version!: string;

    @Column({type: "text"})
    token!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @ManyToOne(type => Users, user => user.userDevices)
    @JoinColumn({name: 'user_id'})
    user!: Users
}