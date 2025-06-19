import { UserRequests } from "../entities/user-requests";
import { BaseService } from "./base";
import dayjs from "dayjs";
import { AppConfigService } from "./app-config";
import { DeepPartial } from "typeorm";
import { APP_CONFIG_KEY } from "../config/app-config-constant";
import { APIGatewayEvent } from "aws-lambda";
import { getClientIp } from 'request-ip';
import { UserHackAttempts } from "../entities/user-hack-attempts";
import { UserService } from "./user";

export class UserRequestService extends BaseService {
    public async findTodayHackAttempt(userId: number) {
        return await this.dbConn.getRepository(UserHackAttempts).createQueryBuilder('userHack').where('userHack.user_id = :userId', {userId}).andWhere('userHack.created_at between :startDate and :endDate', {
            startDate: dayjs().startOf('day').subtract(7, 'hours').format('YYYY-MM-DD HH:mm:ss'),
            endDate: dayjs().endOf('day').subtract(7, 'hours').format('YYYY-MM-DD HH:mm:ss')
        }).getOne();
    }
    public async createTodayHackAttempt(userId: number, attemptKey: string) {
        return await this.dbConn.getRepository(UserHackAttempts).save({user_id: userId, counter: 1, attempt_key: attemptKey});
    }
    public async updateTodayUserHackAttempt(id: number, counter: number) {
        return await this.dbConn.getRepository(UserHackAttempts).createQueryBuilder().update(UserHackAttempts)
        .set({counter})
        .where('id = :id', {id})
        .execute();
    }
    public async validateAndStoreUserRequest(event: APIGatewayEvent, user_id: number): Promise<boolean> {
        const appConfigService  = new AppConfigService(this.dbConn);

        const endpoint = `${event.httpMethod}: ${event.path}`;
        // const clientIp = getClientIp(event) || 'N/A';
        const clientIp = event.headers ? (event.headers['X-Forwarded-For'] || getClientIp(event) || 'N/A') : "N/A";
        const isAllowed         = await this.isAllowed(endpoint, clientIp, user_id);
        const hackAttemptsLimit = await appConfigService.getConfigByKey(APP_CONFIG_KEY.hackAttemptsLimit);
        let hackAttemptsLimitValue = 5;

        if (hackAttemptsLimit) {
            hackAttemptsLimitValue = JSON.parse(hackAttemptsLimit.config_value);
        }

        if (!isAllowed) {
            // store here
            const findHackAttempt = await this.findTodayHackAttempt(user_id);
            // if (!findHackAttempt) {
            //     await this.createTodayHackAttempt(user_id, 'spamming_request');
            // } else {
            //     if (findHackAttempt.counter < 1) {
            //         await this.updateTodayUserHackAttempt(findHackAttempt.id, findHackAttempt.counter + 1)
            //     } else {
            //         const userService = new UserService(this.dbConn);
            //         await userService.banUserByIds({
            //             user_ids    : [user_id],
            //             reason      : 'spamming_request',
            //             expired_in  : 24
            //         })
            //     }
            // }
            if (!findHackAttempt) {
                await this.createTodayHackAttempt(user_id, 'spamming_request');
            } else {
                if (findHackAttempt.counter >= hackAttemptsLimitValue) {
                    const userService = new UserService(this.dbConn);
                    await userService.banUserByIds({
                        user_ids    : [user_id],
                        reason      : 'spamming_request',
                        expired_in  : 24
                    });
                } else {
                    await this.updateTodayUserHackAttempt(findHackAttempt.id, findHackAttempt.counter + 1);
                }
            }
            console.log(findHackAttempt);
            return false;
        }
            
        
        await this.storeUserAPIRequestLog({user_id, endpoint, server_ip: clientIp});
        return true;
    }

    public async storeUserAPIRequestLog(schema: DeepPartial<UserRequests>): Promise<UserRequests> {
        console.log("SCHEMA", schema);
        return await this.dbConn.getRepository(UserRequests).save(schema);
    }

    public async isAllowed(endpoint: string, clientIp: string, userId: number): Promise<boolean> {
        const appConfigService  = new AppConfigService(this.dbConn);

        let limitTime           = 1;
        let endpoints           = [];
        let allowed             = true;
        let countLimit          = 5;
        const limitedEndpoint   = await appConfigService.getConfigByKey(APP_CONFIG_KEY.limiterEndpointList);
        
        if (limitedEndpoint) {
            endpoints = JSON.parse(limitedEndpoint.config_value);
        }
        console.log(endpoints, limitedEndpoint, endpoints.map((data: any) => data.endpoint).includes(endpoint), endpoints.map((data: any) => data.endpoint));

        if (endpoints.length > 0 && endpoints.map((data: any) => data.endpoint).includes(endpoint)) {
            const config    = endpoints.filter((data: any) => data.endpoint == endpoint)[0];
            limitTime       = Number(config.time);
            countLimit      = Number(config.count);
    
            const prevTime  = this.helperService.toDateTime(dayjs().subtract(limitTime, 'seconds'));
            console.log(`SELECT COUNT(user_id) as total FROM user_requests
                WHERE user_id = ${userId}
                AND server_ip = '${clientIp}'
                AND endpoint = '${endpoint}'
                AND created_at > '${prevTime}'`)
            const requests  = await this.dbConn.query(
                `
                SELECT COUNT(user_id) as total FROM user_requests
                WHERE user_id = ?
                AND server_ip = ?
                AND endpoint = ?
                AND created_at > ?
                `,
                [
                    userId,
                    clientIp,
                    endpoint,
                    prevTime
                ]
            );
            console.log("REQUESTS", requests);
            if (requests.length && requests[0]['total'] >= countLimit) {
                allowed = false;
            }
        }
        console.log("IS ALLOWED", allowed);
        return allowed;
    }
}
