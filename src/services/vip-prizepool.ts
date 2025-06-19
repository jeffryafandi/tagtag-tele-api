import { BaseService } from "./base";
import { Connection, InsertResult } from "typeorm";
import { VipPrizepools } from "../entities/vip-prizepools";

export class VipPrizepoolService extends BaseService {
    // constructor (connection: Connection) {

    // }

    public async fetchLatestActivePrizepool(): Promise<VipPrizepools|null> {
        return await this.dbConn.getRepository(VipPrizepools)
        .findOne({
            where: {
                is_active: true
            },
            order: {
                updated_at: 'DESC'
            }
        });
    }
}