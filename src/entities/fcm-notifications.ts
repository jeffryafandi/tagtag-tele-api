import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { Users } from "./users";

export const FcmNotificationFillable = [
    'code',
    'title',
    'body',
    'is_active',
    'published_at'
];

export const FcmNotificationUpdateable = FcmNotificationFillable;

@Entity()
export class FcmNotifications {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "varchar"})
    code!: string;

    @Column({type: "varchar"})
    title!: string;

    @Column({type: "text"})
    body!: string;

    @Column({type: "tinyint"})
    is_active!: boolean;

    @Column({type: "tinyint"})
    is_periodic!: boolean;
    
    @Column({type: "int"})
    next_trigger!: number;

    @Column({type: "timestamp"})
    published_at!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;
}