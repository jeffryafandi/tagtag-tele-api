import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";

export const QuestsFillable = [
    'user_id',
    'started_at',
    'expired_at'
  ];
  
export const QuestsUpdateable = [
    'user_id',
    'started_at',
    'expired_at'
];


@Entity()
export class VipMemberships {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column({type: 'datetime'})
    started_at!: string;

    @Column({type: 'datetime'})
    expired_at!: string;

    @Column("timestamp")
    created_at!: string;
}