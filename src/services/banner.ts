import { Banners } from "../entities/banners";
import { BaseService } from "./base";
import { APIGatewayEvent } from "aws-lambda";

export class BannerService extends BaseService {
    public async getBanners(event: APIGatewayEvent): Promise<[Banners[], number]> {
        const devicePlatform = event.headers['X-Device-Platform'] || event.headers['x-device-platform'] || event.headers['X-DEVICE-PLATFORM'];

        const banners = this.dbConn.getRepository(Banners)
            .createQueryBuilder('banners')
            .where('banners.deleted_at IS NULL')
            .andWhere('banners.is_active = :active', { active: 1 })
            .andWhere('banners.platform IN (:...platforms)', {
                platforms: [devicePlatform, 'all']
            })
            .orderBy('banners.updated_at', 'DESC')
            .take(5);

        const [result, total] = await banners.getManyAndCount();
        return [result, total];
    }
}