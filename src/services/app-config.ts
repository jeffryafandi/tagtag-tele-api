import { TransactionAvailableCodeEnum } from "../interfaces/requests/transaction";
import { AppConfigs } from "../entities/app-configs";
import { BaseService } from "./base";

export class AppConfigService extends BaseService {
    public async getAllConfigs() {
        return await this.dbConn.getRepository(AppConfigs)
        .createQueryBuilder()
        .where('is_active = 1')
        .getMany();
    }

    public async getConfigsIsPublic() {
        return await this.dbConn.getRepository(AppConfigs)
        .createQueryBuilder()
        .where('is_active = 1')
        .andWhere('is_public = 1')
        .getMany();
    }

    public mapConfig(configs: AppConfigs[]) {
        const data: Record<string, any> = {};
        configs.map((config) => {
            let value = config.config_value;
            try {
                value = JSON.parse(value);
            } catch (error) {}
            data[config.config_key] = value;
        })
        return data;
    }

    public async mapAppConfig() {
        const configs   = await this.getAllConfigs();
        let data        = {
            api_version        : process.env.API_VERSION || '0.0.0',
            transaction_codes  : Object.values(TransactionAvailableCodeEnum)
        }
        data = {...data, ...this.mapConfig(configs)};

        return data;
    }

    public async mapAppConfigIsPublic() {
        const configs   = await this.getConfigsIsPublic();
        let data        = {
            api_version        : process.env.API_VERSION || '0.0.0',
            transaction_codes  : Object.values(TransactionAvailableCodeEnum)
        }
        data = {...data, ...this.mapConfig(configs)};

        return data;
    }

    public async getConfigByKey(keyName: string): Promise<AppConfigs | null> {
        return await this.dbConn.getRepository(AppConfigs)
        .createQueryBuilder()
        .where('config_key = :keyName', { keyName })
        .getOne();
    }
}
