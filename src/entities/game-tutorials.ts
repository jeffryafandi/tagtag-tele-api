import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Games } from "./games";

export const GameTutorialsFillable = [
    'game_id',
    'title',
    'description',
    'media_url',
    'media_type',
    'slide_order'
];
 
export const GameTutorialsUpdateable = GameTutorialsFillable;

@Entity()
export class GameTutorials {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'bigint'})
    game_id!: number;

    @Column({ type: 'varchar'})
    title!: string;
    
    @Column({ type: 'varchar'})
    description!: string;
    
    @Column({ type: 'varchar' })
    media_url!: string;
    
    @Column({ type: 'varchar' })
    media_type!: string;
    
    @Column({ type: 'int' })
    slide_order!: number;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;

    @ManyToOne(type => Games, game => game.tutorials)
    @JoinColumn({
        name: "game_id"
    })
    game!: Games;
}
