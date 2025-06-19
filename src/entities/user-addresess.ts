import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";

export const UserAddresessFillable = [
   'user_id',
   'adresess',
   'notes',
   'receipent_name',
   'phone_number',
   'is_primary',
];

export const UserAddresessUpdateable = [
   'user_id',
   'adresess',
   'notes',
   'receipent_name',
   'phone_number',
   'is_primary',
];

@Entity()
export class UserAddresess {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    address!: string;
   
    @Column()
    notes!: string;

    @Column()
    recipient_name!: string;

    @Column()
    phone_number!: string;
   
    @Column()
    is_primary!: boolean;
    
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => Users, user => user.userAddresess)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;

}