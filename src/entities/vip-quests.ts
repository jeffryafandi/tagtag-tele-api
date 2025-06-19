import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { UserVipQuests } from "./user-vip-quests";

export const VipQuestsFillable = [
    'name',
    'description',
    'type',
    'value',
    'vip_point_reward',
    'is_active'
  ];
  
  export const VipQuestsUpdateable = [
    'name',
    'description',
    'type',
    'value',
    'vip_point_reward',
    'is_active'
  ];

  @Entity()
  export class VipQuests {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    description!: string;

    @Column()
    type!: string;

    @Column()
    value!: number;

    @Column()
    vip_point_reward!: number;

    @Column()
    is_active!: boolean;

    @OneToMany(type => UserVipQuests, UserVipQuests => UserVipQuests.vipQuests)
    userVipQuests?: UserVipQuests[];
  }