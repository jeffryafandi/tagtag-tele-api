import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, AfterLoad } from "typeorm";
import { Missions } from "./missions";
import { Quests } from "./quests";
import { UserGameScores } from "./user-game-scores";
import { GameTutorials } from "./game-tutorials";

export const GameFillable = [
    'name',
    'description',
    'game_url',
    'version',
    'banner_url',
    'genre',
    'casual_threshold',
    'casual_coin_prize',
    'casual_stamina_prize',
    'casual_coupon_prize',
    'casual_activity_point_prize'
];

export const GameUpdateable = [
    'name',
    'description',
    'game_url',
    'version',
    'banner_url',
    'genre',
    'casual_threshold',
    'casual_coin_prize',
    'casual_stamina_prize',
    'casual_coupon_prize',
    'casual_activity_point_prize'
];

@Entity()
export class Games {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    description!: string;

    @Column()
    game_url!: string;

    @Column()
    version!: string;

    @Column()
    banner_url!: string;

    @Column()
    casual_threshold!: number;

    @Column()
    casual_coin_prize!: number;

    @Column()
    casual_stamina_prize!: number;

    @Column()
    casual_coupon_prize!: number;

    @Column()
    casual_activity_point_prize!: number;
  
    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => Missions, mission => mission.game)
    missions!: Missions[];
    
    @OneToMany(type => Quests, quest => quest.game)
    quests!: Quests[];
   
    @OneToMany(type => UserGameScores, userGameScores => userGameScores.game)
    userGameScores!: UserGameScores[];

    @OneToMany(type => GameTutorials, tutorial => tutorial.game)
    tutorials!: GameTutorials[];
}