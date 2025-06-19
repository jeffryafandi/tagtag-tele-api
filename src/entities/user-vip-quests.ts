import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { VipQuests } from "./vip-quests";
import { Users } from "./users";

export const UserVipQuestsFillable = [
    'user_id',
    'vip_quest_id',
    'target_value',
    'current_value',
    'completed_at',
    'is_claimed'
];
  
export const UserVipQuestsUpdateable = [
    'user_id',
    'vip_quest_id',
    'target_value',
    'current_value',
    'completed_at',
    'is_claimed'
];

@Entity()
export class UserVipQuests {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    vip_quest_id!: number;

    @Column()
    target_value!: number;

    @Column()
    current_value!: number;

    @Column({type: 'datetime'})
    completed_at!: string;

    @Column()
    is_claimed!: boolean;

    // Relations
    @ManyToOne(type => Users, user => user.userQuests)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;
   
    @ManyToOne(type => VipQuests, vipQuests => vipQuests.userVipQuests)
    @JoinColumn({
        name: "vip_quest_id"
    })
    vipQuests?: VipQuests;
}

