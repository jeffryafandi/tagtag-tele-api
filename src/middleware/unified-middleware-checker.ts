import { MiddlewareFunction, HandlerLambda, NextFunction } from 'middy';
import { APIGatewayEvent, APIGatewayProxyResult, APIGatewayProxyEvent, Context } from 'aws-lambda';
import { checkBannedMiddleware } from './check-ban-middleware';
import { checkForceUpdateMiddleware } from '../middleware/check-force-update';
import { checkXApiSecretMiddleware } from '../middleware/check-x-api-secret';
import { adminCheckWhitelistIp } from '../middleware/admin-check-whitelist-ip';

const routeMiddlewares: Record<string, any[]> = {
    // private admin routes
    "PUT /admin/users/{userId}": [adminCheckWhitelistIp],
    "GET /admin/lucky-wheels": [adminCheckWhitelistIp],
    "GET /admin/lucky-wheels/{luckyWheelId}": [adminCheckWhitelistIp],
    "POST /admin/lucky-wheels": [adminCheckWhitelistIp],
    "PUT /admin/lucky-wheels/{luckyWheelId}": [adminCheckWhitelistIp],
    "DELETE /admin/lucky-wheels/{luckyWheelId}": [adminCheckWhitelistIp],
    "POST /admin/lucky-wheels/{luckyWheelId}/add-prize": [adminCheckWhitelistIp],
    "PUT /admin/lucky-wheel-prizes/{luckyWheelPrizeId}": [adminCheckWhitelistIp],
    "DELETE /admin/lucky-wheel-prizes/{luckyWheelPrizeId}": [adminCheckWhitelistIp],
    "POST /admin/ban/user": [adminCheckWhitelistIp],
    "POST /admin/un-ban/user": [adminCheckWhitelistIp],
    "GET /admin/analytic/user": [adminCheckWhitelistIp],
    "GET /admin/analytic/game": [adminCheckWhitelistIp],
    "GET /admin/users": [adminCheckWhitelistIp],
    "GET /admin/duitku-log/user": [adminCheckWhitelistIp],
    "GET /admin/awd-log/user": [adminCheckWhitelistIp],
    "POST /admin/partners": [adminCheckWhitelistIp],
    "GET /admin/transaction-log/user": [adminCheckWhitelistIp],
    "POST /admin/partner/ads": [adminCheckWhitelistIp],
    "GET /admin/raffle-log-winners/user": [adminCheckWhitelistIp],
    "GET /admin/users-revenue-detail": [adminCheckWhitelistIp],
    "GET /admin/users-withdraw-detail": [adminCheckWhitelistIp],
    "GET /admin/lucky-wheels-analytic": [adminCheckWhitelistIp],
    "GET /admin/lucky-wheels-log": [adminCheckWhitelistIp],
    // public routes
    "POST /auths/register": [],
    "POST /auths/register/{action}": [],
    "POST /auths/login": [],
    "POST /auths/login/google": [checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "PUT /auths/change-password/request": [],
    "GET /auths/forgot-password": [],
    "POST /auths/forgot-password/request": [checkBannedMiddleware],
    "POST /auths/forgotPassword/check": [],
    "POST /auths/change-password": [],
    "PUT /auths/change-email/request": [],
    "PUT /auths/change-email/confirm": [],
    "POST /auths/check-username": [],
    "POST /auths/check-email": [],
    "GET /auths/my-team": [],
    "GET /home/banners": [],
    "GET /lucky-wheels": [],
    "PUT /lucky-wheels/spin": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "GET /affiliates/benefits": [],
    "POST /auths/affiliate/upgrade": [],
    "GET /affiliates/upgrade/approved": [],
    "POST /revenue-baselines": [],
    "POST /revenue-baselines/publish": [],
    "POST /schedular/mark-daily-logins": [adminCheckWhitelistIp],
    "POST /schedular/refresh-lucky-wheel-entries": [adminCheckWhitelistIp],
    "POST /schedular/refresh-quest-assignments": [adminCheckWhitelistIp],
    "POST /schedular/refresh-mission-assignments": [adminCheckWhitelistIp],
    "POST /schedular/calculate-prizepools": [adminCheckWhitelistIp],
    "POST /schedular/send-notification": [adminCheckWhitelistIp],
    "POST /schedular/check-user-activities": [adminCheckWhitelistIp],
    "POST /schedular/check-raffle-status": [adminCheckWhitelistIp],
    "POST /schedular/expiring-user-ban": [adminCheckWhitelistIp],
    "POST /schedular/generate-mystery-boxes": [adminCheckWhitelistIp],
    "POST /schedular/validateStoreUserPurchase": [adminCheckWhitelistIp],
    "POST /schedular/reset-mission-assignments": [adminCheckWhitelistIp],
    "POST /schedular/test-midtrans-disbursement": [],
    "POST /schedular/redis-set-winners-data": [],
    "POST /schedular/reassign-quest-preset": [],
    "POST /prizepools": [],
    "GET /prizepools/leaderboard/{type}": [checkBannedMiddleware],
    "GET /games/{gameId}/tutorials": [],
    "POST /tests/notif": [adminCheckWhitelistIp],
    "POST /test/receive-sns": [adminCheckWhitelistIp],
    "POST /test/send-compute": [adminCheckWhitelistIp],
    "POST /test/duitku/inquiry": [adminCheckWhitelistIp],
    "POST /test/duitku/transfer": [adminCheckWhitelistIp],
    "GET /test/midtrans/accountvalidation": [adminCheckWhitelistIp],
    "POST /test/midtrans/createpayout": [adminCheckWhitelistIp],
    "POST /test/midtrans/approvepayout": [adminCheckWhitelistIp],
    "POST /test/raffle/queue": [adminCheckWhitelistIp],
    "POST /test/awd/prepaid": [adminCheckWhitelistIp],
    "GET /banks": [],
    "POST /banks/check-account": [],
    "GET /operators": [],
    "PUT /user-verifications/{verificationId}/status": [],
    "GET /app-configs": [],
    "GET /awd/webhook": [],
    "GET /testinvoke": [adminCheckWhitelistIp],
    "POST /auths/login/gopay": [checkForceUpdateMiddleware],
    "GET /aris/tekuton": [],
    "POST /v1.0/debit/notify": [],
    // private routes
    "GET /auths": [checkBannedMiddleware],
    "POST /auths/forgot-password": [checkBannedMiddleware],
    "GET /auths/transactions": [checkBannedMiddleware],
    "POST /auths/affiliate": [checkBannedMiddleware],
    // "PUT /auths/withdraw/{platform}": [checkBannedMiddleware],
    "POST /auths/account-validation/gopay": [checkBannedMiddleware],
    // "POST /auths/withdraw/gopay": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    // "POST /auths/summary/gopay": [checkBannedMiddleware],
    "POST /auths/withdraw/{platform}": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "POST /auths/summary/{type}": [checkBannedMiddleware],
    "GET /auths/affiliate": [checkBannedMiddleware],
    "POST /auths/logout": [],
    "GET /auths/commissions": [checkBannedMiddleware],
    "GET /auths/bank-account": [checkBannedMiddleware],
    "POST /auths/bank-account": [checkBannedMiddleware],
    "GET /auths/prizes": [checkBannedMiddleware],
    "PUT /auths/prizes/{userExtPrizeId}/claim": [checkBannedMiddleware],
    "POST /auths/verifications": [checkBannedMiddleware],
    "GET /auths/friends": [checkBannedMiddleware],
    "GET /auths/friends/search": [checkBannedMiddleware],
    "POST /auths/friends/add": [checkBannedMiddleware],
    "POST /auths/friends/reject": [checkBannedMiddleware],
    "POST /auths/friends/approve": [checkBannedMiddleware],
    "POST /auths/friends/remove": [checkBannedMiddleware],
    "POST /auths/add-pin/{action}": [checkBannedMiddleware],
    "POST /auths/forgot-pin/{action}": [checkBannedMiddleware],
    "POST /auths/pin/{action}": [checkBannedMiddleware],
    "GET /home/{dataType}": [checkBannedMiddleware],
    "POST /lucky-wheels/reset-entries": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "PUT /daily-logins/claim": [checkBannedMiddleware],
    "PUT /referrals/claim": [checkBannedMiddleware],
    "PUT /affiliates/upgrade/{affiliateUpgradeId}/status": [],
    "GET /missions/{missionId}/status": [checkBannedMiddleware],
    "PUT /missions/{missionId}/{action}": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "POST /missions/{missionId}/start": [checkBannedMiddleware],
    "POST /missions/{missionId}/ad-mission-view-confirmation": [checkBannedMiddleware],
    "POST /missions/{missionId}/reset": [checkBannedMiddleware],
    "GET /quests/{questId}/status": [checkBannedMiddleware],
    "PUT /quests/claim-completion": [checkBannedMiddleware],
    "PUT /quests/{questId}/finish": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "POST /quests/{questId}/start": [checkBannedMiddleware],
    "POST /quests/{questId}/ad-quest-view-confirmation": [checkBannedMiddleware],
    "PUT /freeplay/{gameId}/finish": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "POST /ads/log": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    "GET /in-app-purchases/products": [checkBannedMiddleware],
    "POST /in-app-purchases": [checkBannedMiddleware],
    "PUT /in-app-purchases/{token}/status": [checkBannedMiddleware],
    "GET /raffles": [checkBannedMiddleware],
    "GET /raffles/{raffleId}": [checkBannedMiddleware],
    "PUT /raffles/{raffleId}/submit": [checkBannedMiddleware],
    "GET /prizepools/histories": [checkBannedMiddleware],
    "GET /prizepools": [],
    "GET /prizepools/{prizepoolId}/winners": [checkBannedMiddleware],
    "POST /games/{gameId}/score": [checkBannedMiddleware],
    "POST /operators/check": [checkBannedMiddleware],
    "POST /operators/purchase": [checkBannedMiddleware],
    "GET /partner/ads": [],
    "PUT /mystery-box/claim": [checkBannedMiddleware],
    "PUT /auths/username/change": [checkBannedMiddleware],
    "POST /in-app-purchases/create-payment": [checkBannedMiddleware],
    "GET /rewarded-ads": [checkBannedMiddleware],
    "PUT /rewarded-ads/{rewardedAdsId}/finish": [checkBannedMiddleware],
    "GET /vip/quests": [checkBannedMiddleware],
    "PUT /vip/quests/{questId}/finish": [checkBannedMiddleware],
    "GET /vip/rewards": [checkBannedMiddleware],
    "PUT /vip/rewards/{vipRewardId}/finish": [checkBannedMiddleware]
    // "PUT /missions/{missionId}/claim-completion": [checkBannedMiddleware],
    // "PUT /missions/{missionId}/finish": [checkBannedMiddleware, checkForceUpdateMiddleware, checkXApiSecretMiddleware],
    // "PUT /auths/withdraw/e-wallet": [checkBannedMiddleware],
    // "PUT /auths/withdraw/bank": [checkBannedMiddleware],
}
export const unfiedHandlerMiddleware = () => {
    const before: MiddlewareFunction<APIGatewayProxyEvent, APIGatewayProxyResult, Context> = async (
        handler: HandlerLambda<APIGatewayEvent, APIGatewayProxyResult>,
        next: NextFunction
    ) => {
        const httpMethod = handler.event.httpMethod;
        let path = handler.event.path;
        const basePath = '/production';
        if (path.startsWith(basePath)) {
            path = path.substring(basePath.length);
        }
        const routeKey = `${httpMethod} ${path}`;
        const resource = handler.event.resource;
        const resourceWithMethod = `${httpMethod} ${resource}`;
        // const middlewares = routeMiddlewares[routeKey] || [];
        const middlewares = routeMiddlewares[resourceWithMethod] || [];
        for (const middleware of middlewares) {
            await middleware().before(handler, next);
        }
        return;
    }

    const after = async (request: any) => {
        // you can transform here
        // console.log("TRIGGER AFTER", request);
    }

    const onError = async (request: any) => {
        let message = request.error.message;
        try {
            message = JSON.parse(message);
        } catch (error) {
            message = message;
        }

        if (typeof message == 'string') {
            console.log("Error check unified handler middleware: ", message);
            request.response = {
                statusCode: 500,
                body: JSON.stringify({
                    message: 'Server error in the unified middleware side'
                })
            };
        }
        else {
            request.response = {
                statusCode: message.statusCode || 401,
                body: JSON.stringify({
                    status: message.statusCode,
                    message: message.message,
                    data: message.data
                }),
            };
        }
    }



    return {
        before,
        after,
        onError
    }
}
