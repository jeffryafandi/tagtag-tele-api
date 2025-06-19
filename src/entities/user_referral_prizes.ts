import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export const UserReferralPrizeFillable = [
    'user_id',
    'referred_user_id',
    'coupons',
    'coins',
    'is_claimed'
 ];
 
 export const UserAddresessUpdateable = [
    'user_id',
    'referred_user_id',
    'coupons',
    'coins',
    'is_claimed'
 ];

 @Entity()
 export class UserReferralPrizes {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    referred_user_id!: number;

    @Column()
    coupons!: number;
   
    @Column()
    coins!: number;
    
    @Column()
    is_claimed!: boolean;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
 }