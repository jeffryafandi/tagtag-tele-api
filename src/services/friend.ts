import { AuthFriendActionRequest, AuthFriendListResponse, FilterFriendStatusEnum, FilterGetAuthFriendRequest, FriendActivityStatusEnum, FriendStatusEnum, UserFriendSchema } from "../interfaces/requests/friend";
import { UserFriends } from "../entities/user-friends";
import { Brackets, DataSource } from "typeorm";
import { UserActivityService } from "./user-activity";
import { UserActivityTypeEnum } from "../entities/user-activities";
import { GameService } from "./game";
import dayjs from "dayjs";
import { Users } from "../entities/users";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { UserService } from "./user";

export class FriendService {
    public ds: DataSource;
    public userActivityService: UserActivityService;
    public gameService: GameService;

    constructor(ds: DataSource) {
        this.ds                     = ds;
        this.userActivityService    = new UserActivityService(ds);
        this.gameService            = new GameService(ds);
    }
    public async getMapNotFriendedUsers(userId: number, params: FilterGetAuthFriendRequest): Promise<Array<AuthFriendListResponse>> {
        const users = await this.getNotFriendedUsers(userId, params);
        const mapped = await Promise.all(users.map(async (user) => {
            const activities        = await this.userActivityService.getUserLatestActivity(user.id);
            const activity          = activities.filter((a) => a.userActivity_type === UserActivityTypeEnum.activity);
            const connection        = activities.filter((a) => a.userActivity_type === UserActivityTypeEnum.connection);
            let activityDescription = activity.length > 0 ? activity[0].userActivity_description : 'bermain game';
            const userConnection    = connection.length > 0 ? connection[0].userActivity_description : FriendActivityStatusEnum.offline;
            activities.sort((a, b) => b.userActivity_created_at - a.userActivity_created_at);

            if (activity.length > 0) {
                if (activity[0].userActivity_logable_type === 'games') {
                    const game          = await this.gameService.getGameById(Number(activity[0].userActivity_logable_id));
                    activityDescription = `bermain ${game?.name || 'game'}`
                }
            }
            return {
                id              : user.id,
                username        : user.username,
                avatar          : user.avatar,
                last_activity   : userConnection === FriendActivityStatusEnum.offline ? `Terakhir ${activityDescription}` : `Sedang ${activityDescription}`,
                last_activity_at: activities.length > 0 ? dayjs(activities[0].userActivity_created_at).valueOf() : 0,
                status          : userConnection,
                friend_status   : FriendStatusEnum.notFriend
            }
        }));
        return mapped;
    }

    public async mapUserFriend(userId: number, params: FilterGetAuthFriendRequest): Promise<Array<AuthFriendListResponse>> {
        const friends   = await this.getUserFriendsById(userId, params);
        const mapped    = await Promise.all(friends.filter((filtered) => {
            if (params.friend_status === FilterFriendStatusEnum.invite) {
                return filtered.owner;
            }

            return filtered.friendDetail;
        }).map(async (friend) => {
            const activities        = await this.userActivityService.getUserLatestActivity((params.friend_status === FilterFriendStatusEnum.invite) ? friend.user_id : friend.friended_id);
            const activity          = activities.filter((a) => a.userActivity_type === UserActivityTypeEnum.activity);
            const connection        = activities.filter((a) => a.userActivity_type === UserActivityTypeEnum.connection);
            let activityDescription = activity.length > 0 ? activity[0].userActivity_description : 'bermain game';
            const userConnection    = connection.length > 0 ? connection[0].userActivity_description : FriendActivityStatusEnum.offline;
            activities.sort((a, b) => b.userActivity_created_at - a.userActivity_created_at);

            if (activity.length > 0) {
                if (activity[0].userActivity_logable_type === 'games') {
                    const game          = await this.gameService.getGameById(Number(activity[0].userActivity_logable_id));
                    activityDescription = `bermain ${game?.name || 'game'}`
                }
            }
            return {
                id              : (params.friend_status === FilterFriendStatusEnum.invite) ? friend.user_id : friend.friended_id,
                username        : (params.friend_status === FilterFriendStatusEnum.invite) ? friend.owner.username : friend.friendDetail.username,
                avatar          : (params.friend_status === FilterFriendStatusEnum.invite) ? friend.owner.avatar : friend.friendDetail.avatar,
                last_activity   : userConnection === FriendActivityStatusEnum.offline ? `Terakhir ${activityDescription}` : `Sedang ${activityDescription}`,
                last_activity_at: activities.length > 0 ? dayjs(activities[0].userActivity_created_at).valueOf() : 0,
                status          : userConnection,
                friend_status   : friend.status
            }
        }));
        if (params.type !== FriendActivityStatusEnum.all) {
            return mapped.filter((map) => map.status === params.type)
        }
        return mapped;
    }

    public async insertBulkUserFriendData(data: Array<UserFriendSchema>) {
        await this.ds.getRepository(UserFriends)
        .createQueryBuilder()
        .insert()
        .into(UserFriends)
        .values(data)
        .execute();
    }

    public async bulkRemoveUserFriendData(userIds: Array<number>, friendedId: number) {
        await this.ds.getRepository(UserFriends)
        .createQueryBuilder('userFriends')
        .delete()
        .from(UserFriends)
        .where('user_id IN(:...userIds)', { userIds })
        .andWhere('friended_id = :friendedId', { friendedId })
        .execute()
    }

    public async bulkUpdateUserFriend(userIds: Array<number>, friendedId: number, schema: QueryDeepPartialEntity<UserFriends>) {
        await this.ds.getRepository(UserFriends)
        .createQueryBuilder()
        .update()
        .set(schema)
        .where('user_id IN(:...userIds)', { userIds })
        .andWhere('friended_id = :friendedId', { friendedId })
        .execute();
    }

    public async getAllUserFriendByUserId(userId: number) {
        return await this.ds.getRepository(UserFriends)
        .createQueryBuilder('userFriend')
        .where('user_id = :userId', { userId })
        .orWhere(new Brackets((qb) => {
            return qb.where('friended_id = :userId', { userId })
            .andWhere('status = :status', { status: FriendStatusEnum.pending })
        }))
        .getMany();
    }

    public async approveFriendForUser(user: Users, payload: AuthFriendActionRequest) {
        const friendRequest = await this.getUserFriendsById(user.id, {
            friend_status   : FilterFriendStatusEnum.invite,
            type            : FriendActivityStatusEnum.all
        });

        const pendingApprove= payload.user_ids.filter((userId) => {
            return friendRequest.map((friend) => friend.user_id).includes(userId);
        });

        if (pendingApprove.length > 0) {
            const bulkData  = pendingApprove.map((friendId) => ({
                user_id     : user.id,
                friended_id : friendId,
                status      : FriendStatusEnum.approved
            }));

            await this.bulkUpdateUserFriend(pendingApprove.map((userId) => userId), user.id, { status: FriendStatusEnum.approved });
            await this.insertBulkUserFriendData(bulkData);
        }
    }

    public async rejectFriendInviteForUser(user: Users, payload: AuthFriendActionRequest) {
        const friendRequest = await this.getUserFriendsById(user.id, {
            friend_status   : FilterFriendStatusEnum.invite,
            type            : FriendActivityStatusEnum.all
        });

        const pendingApprove= payload.user_ids.filter((userId) => {
            return friendRequest.map((friend) => friend.user_id).includes(userId);
        });

        if (pendingApprove.length > 0) {
            await this.bulkRemoveUserFriendData(pendingApprove.map((userId) => userId), user.id);
        }
    }

    public async removeFriendForUser(user: Users, payload: AuthFriendActionRequest) {
        const userFriends = await this.getAllUserFriendByUserId(user.id);

        const friendIds = userFriends.filter((friend) => Number(friend.user_id) === Number(user.id)).map((friend) => friend.friended_id);
        const exists    = payload.user_ids.filter((userId) => friendIds.includes(userId));
        
        for (const friendId of exists) {
            await this.bulkRemoveUserFriendData([user.id], friendId);
        }
        if (exists.length > 0) {
            await this.bulkRemoveUserFriendData(exists, user.id);
        }
    }

    public async requestFriendForUser(user: Users, payload: AuthFriendActionRequest) {
        const userFriends = await this.getAllUserFriendByUserId(user.id);

        const friendIds     = userFriends.filter((friend) => Number(friend.user_id) === Number(user.id)).map((friend) => friend.friended_id);
        const friendInvited = userFriends.filter((friend) => Number(friend.friended_id) === Number(user.id)).map((inviteUser) => inviteUser.user_id);
        
        const notFriends    = payload.user_ids.filter((userId) => ![...friendIds, ...friendInvited].includes(userId));
        const pendingApprove= payload.user_ids.filter((userId) => friendInvited.includes(userId));

        if (notFriends.length > 0) {
            const bulkData  = notFriends.map((friendId) => ({
                user_id     : user.id,
                friended_id : friendId,
                status      : FriendStatusEnum.pending
            }));

            await this.insertBulkUserFriendData(bulkData);
        }

        if (pendingApprove.length > 0) {
            const bulkData  = pendingApprove.map((friendId) => ({
                user_id     : user.id,
                friended_id : friendId,
                status      : FriendStatusEnum.approved
            }));

            await this.bulkUpdateUserFriend(pendingApprove.map((userId) => userId), user.id, { status: FriendStatusEnum.approved });
            await this.insertBulkUserFriendData(bulkData);
        }
    }

    public async getUserFriendsById(userId: number, params: FilterGetAuthFriendRequest): Promise<Array<UserFriends>> {
        const repo = this.ds.getRepository(UserFriends)
        .createQueryBuilder('userFriends')
        .leftJoinAndSelect('userFriends.friendDetail', 'friendDetail')
        .leftJoinAndSelect('userFriends.owner', 'owner')
        
        if (params.friend_status === FilterFriendStatusEnum.invite) {
            repo.where('userFriends.friended_id = :userId', {userId})
            .andWhere('userFriends.status = :status', {status: FriendStatusEnum.pending});
        } else {
            repo.where('userFriends.user_id = :userId', {userId})
            .andWhere('userFriends.status = :status', {status: (params.friend_status === FilterFriendStatusEnum.request) ? FriendStatusEnum.pending : FriendStatusEnum.approved});
        }

        if (params.username) {
            repo.andWhere('friendDetail.username LIKE :username', {username: `${params.username}%`})
        }

        return await repo.getMany();
    }

    public async getNotFriendedUsers(userId: number, params: FilterGetAuthFriendRequest) {
        const userFriends   = await this.getAllUserFriendByUserId(userId);
        const userService   = new UserService(this.ds);
        const friendIds     = userFriends.filter((friend) => Number(friend.user_id) === Number(userId)).map((friend) => friend.friended_id);
        const friendInvited = userFriends.filter((friend) => Number(friend.friended_id) === Number(userId)).map((inviteUser) => inviteUser.user_id);
        const friendRelated = [...friendIds, ...friendInvited, userId];
        const users         = await userService.getAllUsersExceptIDs(friendRelated, { username: params.username });
        return users;
        // const notFriends    = payload.user_ids.filter((userId) => ![...friendIds, ...friendInvited].includes(userId));
    }
}