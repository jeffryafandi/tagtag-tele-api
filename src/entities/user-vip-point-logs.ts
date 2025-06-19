import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export const UserVipPointLogsFillable = [
    'name',
    'user_id',
    'rewarded_ads_item_id',
    'claimed_at',
    'is_claimed'
];

export const UserVipPointLogsUpdateable = UserVipPointLogsFillable;

@Entity()
export class UserVipPointLogs {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column()
  vip_quest_id!: number;

  @Column()
  source!: string;

  @Column()
  point!: number;
}
