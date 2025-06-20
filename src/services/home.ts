import { Connection } from "typeorm";
import { BannerService } from "./banner";
import { BaseService } from "./base";
import { DailyLoginService } from "./daily-login";
import { MissionService } from "./mission";
import { QuestService } from "./quest";
import { GameService } from "./game";
import { UserMissions } from "../entities/user-missions";
import { Users } from "../entities/users";
import { APIGatewayEvent } from "aws-lambda";

export class HomeService extends BaseService{
    protected questService      : QuestService;
    protected bannerService     : BannerService;
    protected missionService    : MissionService
    protected dailyLoginService : DailyLoginService;
    protected gameService       : GameService;

    constructor(dbConn: Connection) {
        super(dbConn);
        this.bannerService      = new BannerService(dbConn);
        this.questService       = new QuestService(dbConn);
        this.dailyLoginService  = new DailyLoginService(dbConn);
        this.missionService     = new MissionService(dbConn);
        this.gameService        = new GameService(dbConn);
    }

    public async getHomeBanners(event: APIGatewayEvent): Promise<object[]> {
        const [banners, total] = await this.bannerService.getBanners(event);
        const mappedBanners = banners.map((banner) => {
            return {
                id          : banner.id,
                title       : banner.title,
                link        : banner.link,
                image_url   : banner.image_url
            };
        });

        return mappedBanners;
    }

    public async getHomeDailyQuest(user: Users): Promise<object> {
        const userAllQuest = await this.questService.getUserQuestList(user.id);
        const claimedQuest = userAllQuest.filter((userQuest) => {
            return userQuest.is_claimed;
        });

        const mapDailyQuest = await Promise.all(userAllQuest.map( async (userQuest) => {
            return {
                id              : userQuest.quest?.id,
                description     : userQuest.quest?.description,
                coupon_prize    : userQuest.coupon_prize,
                coin_prize      : userQuest.coin_prize,
                target_value    : userQuest.target_value,
                current_value   : userQuest.current_value,
                is_claimed      : userQuest.is_claimed,
                game            : (!userQuest.quest?.game) ? {} : this.gameService.mapBasicGameObject(userQuest.quest.game)
            }
        }));

        return {
            is_completed    : claimedQuest.length == userAllQuest.length,
            can_claim_prize : ((claimedQuest.length == userAllQuest.length) && !user.complete_quest_claimed),
            quests          : mapDailyQuest
        };
    }

    public async getHomeDailyLogin(userId: number): Promise<object> {
        let dailyLoginUser = await this.dailyLoginService.getCurrentDailyLoginUser(userId);

        if (!dailyLoginUser) {
            dailyLoginUser = await this.dailyLoginService.createNewDailyLoginUser(userId);
        }

        const prizes = dailyLoginUser?.dailyLogin?.dailyLoginPrizes?.map((prize) => {
            let isClaimed = false;
            if ((dailyLoginUser?.dailyLoginPrize)) {
                if ((dailyLoginUser?.dailyLoginPrize?.day) > prize.day) {
                    isClaimed = true;
                }
                if ((dailyLoginUser?.dailyLoginPrize?.day) == prize.day) {
                    isClaimed = dailyLoginUser.is_claimed_today;
                }
            }

            return {
                id                     : prize.id,
                day                    : prize.day,
                coupon_prize           : prize.coupon_prize,
                coin_prize             : prize.coin_prize,
                activity_point_prize   : prize.activity_point_prize,
                is_claimed             : isClaimed
            };
        });

        const mapDailyLogin = {
            is_claimed_today: dailyLoginUser?.is_claimed_today || false,
            prizes
        };

        return mapDailyLogin;
    }

    public async getHomeCasualGames(userId: number): Promise<object> {
        const userMissions          = await this.missionService.getIncompleteMissionList(userId);
        const missionIds: number[]  = [];
        userMissions.forEach((userMission) => {
            if (!missionIds.includes(userMission.mission_id)) missionIds.push(userMission.mission_id)
        });

        const mapCasualGames = await Promise.all(missionIds.map(async (missionId) => {
            const userMissions  = await this.missionService.getUserMissionByMissionId(userId, missionId);
            const latestMission = userMissions[0];
            const played = userMissions.filter((userMission) => {
                return ((latestMission.session_code === userMission.session_code) && userMission.is_claimed);
            });

            let claimedCoupon       = 0;
            const maxCouponTarget   = this.missionService.calculateMaximumCouponTarget(latestMission.missions);

            if (played.length) {
                claimedCoupon = played.reduce((couponValue: number, currentValue: UserMissions) => {
                    return couponValue + currentValue.coupon_prize
                }, 0)
            }

            const data = {
                id                  : missionId,
                description         : latestMission.missions?.description,
                coupon_prize        : latestMission.coupon_prize,
                target_value        : latestMission.target_value,
                is_claimed          : played.length == latestMission.missions?.total_stages,
                max_coupon_target   : maxCouponTarget,
                current_coupon      : (claimedCoupon < maxCouponTarget) ? claimedCoupon : maxCouponTarget,
                total_played        : played.length,
                total_stages        : latestMission.missions?.total_stages,
                complete_coin_prize : latestMission.missions?.complete_coin_prize,
                allow_claim_prize   : played.length == latestMission.missions?.total_stages && !latestMission.complete_prize_claimed,
                game                : (!latestMission.missions?.game) ? {} : this.gameService.mapBasicGameObject(latestMission.missions.game),
            };

            return data;
        }));
        mapCasualGames.sort((a: any, b: any) => a.is_claimed - b.is_claimed)
        return { missions: mapCasualGames };
    }
}