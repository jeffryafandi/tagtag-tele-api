import { UserExtPrizes } from "../entities/user-ext-prizes";
import { BaseService } from "./base";

export class ExternalPrizeService extends BaseService {
    public async assignExtPrizeToUser(userId: number, ext_prize_id: number) {
        return await this.dbConn.getRepository(UserExtPrizes).save({
            user_id: userId,
            ext_prize_id
        })
    }

     public async fetchUserExtPrizeById(id: number): Promise<UserExtPrizes|null> {
        return await this.dbConn.getRepository(UserExtPrizes).findOne({
            where: {id},
            join: {
                alias               : 'userExtPrize',
                leftJoinAndSelect   : {
                    extPrize: 'userExtPrize.extPrize'
                }
            }
        });
    }
}