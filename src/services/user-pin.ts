import { DeepPartial } from "typeorm";
import { UserPins } from "../entities/user-pins";
import { BaseService } from "./base";
import { Users } from "../entities/users";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

export class UserPinService extends BaseService {
    public async storeNewUserPin(schema: DeepPartial<UserPins>): Promise<UserPins> {
        return await this.dbConn.getRepository(UserPins).save(schema);
    }

    public async fetchUserPinById(id: number): Promise<UserPins|null> {
        return await this.dbConn.getRepository(UserPins).findOne({where: {id}});
    }

    public async deleteUserPinsByUserId(userId: number) {
        return await this.dbConn.getRepository(UserPins)
        .createQueryBuilder()
        .delete()
        .from(UserPins)
        .where('user_id = :userId', {userId})
        .execute();
    }

    public async fetchVerifiedUserPins(user: Users): Promise<Array<UserPins>> {
        return await this.dbConn.getRepository(UserPins)
        .createQueryBuilder()
        .where('user_id = :userId', {userId: user.id})
        .andWhere('is_verified = 1')
        .getMany()
    }

    public async fetchLatestUnverifiedUserPin(user: Users): Promise<UserPins|null> {
        return await this.dbConn.getRepository(UserPins)
        .findOne({
            where: {
                user_id     : user.id,
                is_verified : false
            },
            order: {
                created_at  : 'DESC'
            }
        }); 
    }

    public async findUnverifiedUserPinToken(user: Users, token: string): Promise<UserPins|null> {
        return await this.dbConn.getRepository(UserPins)
        .findOne({
            where: {
                user_id             : user.id,
                request_pin_token   : token,
                is_verified         : false
            }
        });
    }

    public async verifyUserPinById(id: number) {
        return await this.dbConn.getRepository(UserPins).update(id, {
            is_verified         : true,
            token_expired_at    : null,
            request_pin_token   : null
        });
    }

    public async updateUserPin(id: number, payload: QueryDeepPartialEntity<UserPins>) {
        await this.dbConn.getRepository(UserPins)
        .update(id, payload);
    }
}