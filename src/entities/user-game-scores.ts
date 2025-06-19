import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad, ManyToMany } from "typeorm";
import { Games } from "./games";

export const UserGameFillable = [
    'user_id',
    'game_id',
    'score',
    'session_code'
];

export const UserGameUpdateable = [
    'user_id',
    'game_id',
    'score',
    'session_code'
];

@Entity()
export class UserGameScores {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unsigned: true, nullable: false})
    user_id!: number;

    @Column({ unsigned: true, nullable: false})
    game_id!: number;

    @Column()
    score!: number;

    @Column()
    session_code!: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Games, game => game.userGameScores)
    @JoinColumn({
        name: "game_id"
    })
    game!: Games;
}