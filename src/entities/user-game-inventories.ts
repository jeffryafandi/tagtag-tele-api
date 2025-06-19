import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne } from "typeorm";
import { GameInventories } from "./game-inventories";
import { Users } from "./users";

export const UserGameInventoriesFillable = [
   'user_id',
   'inventory_id',
   'quantity',
   'expired_at'
];

export const UserGameInventoriesUpdateable = [
   'user_id',
   'inventory_id',
   'quantity',
   'expired_at'
];

@Entity()
export class UserGameInventories {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    user_id!: number;

    @Column()
    inventory_id!: number;
   
    @Column()
    quantity!: number;
    
    @Column("timestamp")
    expired_at?: string;

    @Column("timestamp")
    created_at?: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @ManyToOne(type => Users, user => user.userGameInventories)
    @JoinColumn({
        name: "user_id"
    })
    user?: Users;
   
    @ManyToOne(type => GameInventories, gameInventories => gameInventories.userGameInventories)
    @JoinColumn({
        name: "inventory_id"
    })
    gameInventory?: GameInventories;
}