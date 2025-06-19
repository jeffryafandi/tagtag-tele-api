import { FriendActivityStatusEnum } from "../interfaces/requests/friend";
import { UserActivities, UserActivityTypeEnum } from "../entities/user-activities";
import { DataSource, DeepPartial } from "typeorm";
import dayjs from "dayjs";
import { PusherService } from "./pusher";
import { EVENT_NAME } from "../config/pusher-constant";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

export class UserActivityService {
    public ds: DataSource;
    
    constructor(ds: DataSource) {
        this.ds = ds;
    }

    public async getUserLatestActivity(userId: number) {
        const activities = this.ds.createQueryBuilder()
        .select("ua.*")
        .from((qb) => {
            return qb.select("userActivity")
            .from('user_activities', 'userActivity')
            .where('userActivity.user_id = :userId', {userId})
            .orderBy('userActivity.created_at', 'DESC')
            .limit(10)
        }, "ua")
        .groupBy('ua.userActivity_type')
        .limit(2)
        .getRawMany();
        
        return activities;
    }

    public async storeUserActivityConnection(userId: number) {
        await this.ds.getRepository(UserActivities).save({
            user_id     : userId,
            type        : UserActivityTypeEnum.connection,
            description : 'online'
        });
    }

    public async findUserActivityConnection(userId: number): Promise<UserActivities|null> {
        return await this.ds.getRepository(UserActivities).findOne({
            where: {
                user_id: userId
            }
        });
    }

    public async storeNewUserActivity(payload: DeepPartial<UserActivities>): Promise<UserActivities> {
        return await this.ds.getRepository(UserActivities).save(payload);
    }

    public async updateUserActivityConnection(userId: number, userActivityStatus: FriendActivityStatusEnum) {
        await this.ds.getRepository(UserActivities)
        .createQueryBuilder()
        .update()
        .set({
            description : userActivityStatus,
            updated_at  : dayjs().format('YYYY-MM-DDTHH:mm:ss')
        })
        .where({
            user_id : userId,
            type    : UserActivityTypeEnum.connection
        })
        .execute();
    }
    
    public async findIdleUser(stringDate: string): Promise<Array<UserActivities>> {
        return await this.ds.getRepository(UserActivities)
        .createQueryBuilder('userActivity')
        .leftJoinAndSelect('userActivity.user', 'user')
        .where('userActivity.type = :type', { type: UserActivityTypeEnum.connection })
        .andWhere('userActivity.description = :desc', { desc: 'online' })
        .andWhere('userActivity.updated_at < :stringDate', { stringDate })
        .getMany();
    }

    public async bulkUpdateUserActivityConnection(ids: Array<number>, desc: FriendActivityStatusEnum) {
        await this.ds.getRepository(UserActivities)
        .createQueryBuilder()
        .update()
        .set({
            description: desc,
            updated_at: dayjs().format('YYYY-MM-DDTHH:mm:ss')
        })
        .where('id IN(:...ids)', {ids})
        .execute();
    }

    public async setIdleUserToOffline(stringDate: string) {
        const activities    = await this.findIdleUser(stringDate);
        const ids           = activities.map((userActivity) => userActivity.id);
        const pusherService = new PusherService();
        if (activities.length > 0) {
            for (const activity of activities) {
                if (activity.user) {
                    await pusherService.publish(`user-event`, `${EVENT_NAME.activity}:${activity.user_id}`, {
                        data: {
                            user: {
                                id      : activity.user.id,
                                username: activity.user.username
                            },
                            status: FriendActivityStatusEnum.offline
                        }
                    });
                }
            }
            await this.bulkUpdateUserActivityConnection(ids, FriendActivityStatusEnum.offline);
        }
    }
}
