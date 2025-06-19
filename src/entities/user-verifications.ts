import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Users } from "./users";

export const UserVerificationsFillable = [
    'user_id',
    'image_url',
    'status'
];
 
export const UserVerificationsUpdateable = UserVerificationsFillable;

@Entity()
export class UserVerifications {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;

    @Column({ type: 'varchar' })
    image_url!: string

    @Column({ type: 'varchar' })
    status!: string

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @ManyToOne(type => Users, user => user.verification)
    @JoinColumn({
        name: 'user_id'
    })
    user!: Users;
}
