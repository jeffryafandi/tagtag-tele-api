import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

export const QuestsFillable = [
  'user_id',
  'preset_id',
  'date',
];

export const QuestsUpdateable = [
  'user_id',
  'preset_id',
  'date',
];

@Entity()
export class UserMissionsPresets {
    @PrimaryGeneratedColumn()
    user_id!: number;

    @Column()
    preset_id!: number;
   
    @Column("timestamp")
    date?: string;
}