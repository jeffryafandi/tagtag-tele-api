import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export const UserRewardedAdsFillable = [
    'name',
    'user_id',
    'rewarded_ads_item_id',
    'claimed_at',
    'is_claimed'
];

export const UserRewardedAdsUpdateable = UserRewardedAdsFillable;

@Entity()
export class UserRewardedAds {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column()
  rewarded_ads_id!: number;

  @Column({type: 'datetime'})
  claimed_at!: string;

  @Column()
  is_claimed!: boolean;

  @Column("timestamp")
  created_at!: string;

  @Column("timestamp")
  updated_at!: string;
}
