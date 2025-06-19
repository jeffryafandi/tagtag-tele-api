import * as lambda from 'aws-lambda';
import { Database } from '../database';
import { BaseResponse } from '../interfaces/generals/response';
import { ResponseService } from '../services/response';
import { AuthService } from '../services/auth';
import { RewardedAdsService } from '../services/rewarded-ads';
import { HelperService } from '../services/helper';

export const getRewardedAds: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    const helperService = new HelperService();
    return await helperService.withConnection(async (connection) => {
        const authService           = new AuthService(connection);
        const userService           = authService.userService;
        const rewardedAdsService    = new RewardedAdsService(connection);
        const rawToken              = event.headers.Authorization;
        const user                  = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));

        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});
        const quests = await rewardedAdsService.getRewardedAds(user);
        return ResponseService.baseResponseJson(200, "Data fetched successfully", quests);
    });
}

export const finishingRewardedAds: lambda.Handler = async (event: lambda.APIGatewayEvent): Promise<BaseResponse> => {
    try {
        const connection    = await new Database().getConnection();
        const authService   = new AuthService(connection);
        const userService   = authService.userService;
        const rewardedAdsService    = new RewardedAdsService(connection);
        const rewardedAdsId       = event.pathParameters?.rewardedAdsId;

        if (!rewardedAdsId || isNaN(Number(rewardedAdsId))) return ResponseService.baseResponseJson(422, 'Please insert valid rewardedAdsId', {});

        const rawToken = event.headers.Authorization;
        const user = await userService.getUserByApiToken(authService.sanitizeRawToken(`${rawToken}`));
        if (!user) return ResponseService.baseResponseJson(422, 'User is not found', {});

        const response = await rewardedAdsService.finishingRewardedAdsId(user, Number(rewardedAdsId));
        return ResponseService.baseResponseJson(200, "Request processed successfully", response);
    } catch (error: any) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something wrong with the finishingQuest request', {error: error?.message ? error.message : JSON.stringify(error)});
    }
}