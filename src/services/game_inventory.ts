import { UserGameInventories } from "../entities/user-game-inventories";
import { GameInventories } from "../entities/game-inventories";
import { BaseService } from "./base";
import { DeepPartial, Brackets } from "typeorm";
import { Users } from "../entities/users";

export class GameInventoryService extends BaseService {
    public async fetchInventoryById(id: number): Promise<GameInventories|null> {
        return await this.dbConn.getRepository(GameInventories)
        .findOne({where: {id}});
    }
    public async getInventoryByCode (inventoryCode: string): Promise<GameInventories|null> {
        return await this.dbConn.getRepository(GameInventories)
        .findOne({where: {code: inventoryCode}});
    }

    public async getUserInventoryByInventoryId (userId: number, inventoryId: number) {
        return await this.dbConn.getRepository(UserGameInventories)
        .findOne({
            where: {user_id: userId, inventory_id: inventoryId},
            join: {
                alias: 'userInventories',
                leftJoinAndSelect: {
                    gameInventory: 'userInventories.gameInventory'
                }
            }
        });
    } 

    public async substractUserGameInventory (userId: number, inventoryCode: string, qtyToReduce: number = 1) {
        const gameInventory = await this.getInventoryByCode(inventoryCode);
        if (!gameInventory) return;

        const currentUserInventory = await this.getUserInventoryByInventoryId(userId, gameInventory.id);
        if (!currentUserInventory) return;

        return await this.dbConn.getRepository(UserGameInventories)
        .createQueryBuilder()
        .update()
        .set({
            quantity: Number(currentUserInventory?.quantity) - qtyToReduce
        })
        .where('id = :userInventoryId', {userInventoryId: currentUserInventory?.id})
        .execute();
    }

    public async getUserAllInventories (userId: number, time: string = '') {
        const gameInventories = this.dbConn.getRepository(UserGameInventories)
                                .createQueryBuilder('userGameInventories')
                                .leftJoinAndSelect('userGameInventories.gameInventory', 'gameInventory')
                                .where('userGameInventories.user_id = :userId', {userId})

        if (time) {
            gameInventories.andWhere(new Brackets(qb => {
                qb.where('userGameInventories.expired_at IS NULL')
                    .orWhere('userGameInventories.expired_at > :time', { time });
            }));
        } else {
            gameInventories.andWhere('userGameInventories.expired_at IS NULL');
        }
        
        return await gameInventories.getMany();
    }

    public async getUserExtraLife(userId: number){
        const extraLife = this.dbConn.getRepository(UserGameInventories)
                            .createQueryBuilder('userGameInventories')
                            .select('userGameInventories.quantity')
                            .where('userGameInventories.user_id = :userId', {userId})
                            .andWhere('userGameInventories.inventory_id = 2')
        return await extraLife.getOne();
    }

    public calculateTotalMultiplier(userInventories: UserGameInventories[]): number {
        let rewardMultiplier = 0;
        userInventories.forEach((userInventory) => {
            const gameInventory = userInventory.gameInventory;
            if (gameInventory) {
                rewardMultiplier = rewardMultiplier + gameInventory.value;
            }
        });
        return (rewardMultiplier) || 1;
    }

    public async getActiveUserInventories(user: Users, time: string): Promise<UserGameInventories[]> {
        return await this.dbConn.getRepository(UserGameInventories)
        .createQueryBuilder('userInventories')
        .leftJoinAndSelect('userInventories.gameInventory', 'gameInventory')
        .where('userInventories.user_id = :userId', {userId: user.id})
        .andWhere('userInventories.expired_at > :time', {time})
        .andWhere('userInventories.expired_at IS NOT NULL')
        .getMany();
    }

    public async storeNewUserInventory(schema: DeepPartial<UserGameInventories>) {
        await this.dbConn.getRepository(UserGameInventories).save(schema);
    }

    public async addUserInventoryQuantity(userId: number, userInventory: UserGameInventories, qtyToAdd: number = 1) {
        await this.dbConn.getRepository(UserGameInventories).update(userInventory.id, {
            user_id         : userId,
            inventory_id    : userInventory.inventory_id,
            quantity        : userInventory.quantity + qtyToAdd
        });
    }
}