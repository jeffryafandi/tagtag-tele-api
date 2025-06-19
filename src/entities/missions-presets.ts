import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

export const QuestsFillable = [
  'name',
  'type',
  'is_active',
];

export const QuestsUpdateable = [
  'name',
  'type',
  'is_active',
];

@Entity()
export class MissionsPresets {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;
   
    @Column()
    type!: string;

    @Column()
    is_active!: boolean;
}