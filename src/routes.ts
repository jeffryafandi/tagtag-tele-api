import * as lambda from "aws-lambda";
import { MiddlewareWrapper } from "./middleware";
import { unfiedHandlerMiddleware } from "./middleware/unified-middleware-checker";

const publicRoutes: any = {
  "GET /testing/ip": "controllers/auth.testIp",
  "POST /auths/register": "controllers/auth.register",
  "POST /auths/register/{action}": "controllers/auth.authRegistartionHandler",
  "POST /auths/login": "controllers/auth.loginWithUsernameAndPassword",
  "POST /auths/login/google": "controllers/auth.loginWithGoogleId",
  "POST /auths/login/gopay": "controllers/auth.loginWithGopayId",
  "POST /auths/login/telegram": "controllers/auth.loginWithTelegram",
  "PUT /auths/change-password/request":
    "controllers/auth.changePasswordRequest",
  "GET /auths/forgot-password": "controllers/auth.forgotPasswordPage",
  "POST /auths/forgot-password/request":
    "controllers/auth.forgotPasswordRequest",
  "POST /auths/forgotPassword/check":
    "controllers/auth.checkChangePasswordToken",
  "POST /auths/change-password": "controllers/auth.changePassword",
  "PUT /auths/change-email/request": "controllers/auth.changeEmailOTP",
  "PUT /auths/change-email/confirm": "controllers/auth.changeEmail",
  "POST /auths/check-username": "controllers/auth.authCheckUsername",
  "POST /auths/check-email": "controllers/auth.authCheckEmail",
  "GET /auths/my-team": "controllers/auth.getAuthMyTeam",
  "GET /home/banners": "controllers/home.getHomeBanners",
  "GET /lucky-wheels": "controllers/lucky-wheels.getLuckyWheels",
  "PUT /lucky-wheels/spin": "controllers/lucky-wheels.luckyWheelSpin",
  "GET /affiliates/benefits": "controllers/affiliate.getBenefits",
  "POST /auths/affiliate/upgrade":
    "controllers/affiliate.affiliateUpgradeRequest",
  "GET /affiliates/upgrade/approved":
    "controllers/affiliate.upgradeRequestApproved",
  "POST /revenue-baselines": "controllers/revenue.addRevenueBaseline",
  "POST /revenue-baselines/publish":
    "controllers/revenue.publishRevenueBaseline",
  "POST /schedular/mark-daily-logins": "controllers/scheduler.markDailyLogin",
  "POST /schedular/refresh-lucky-wheel-entries":
    "controllers/scheduler.resetLuckyWheel",
  "POST /schedular/refresh-quest-assignments":
    "controllers/scheduler.reassignQuest",
  "POST /schedular/refresh-mission-assignments":
    "controllers/scheduler.refreshMission",
  "POST /schedular/calculate-prizepools":
    "controllers/scheduler.calculatePrizepool",
  "POST /schedular/send-notification":
    "controllers/scheduler.sendingNotification",
  "POST /schedular/check-user-activities":
    "controllers/scheduler.checkUserActivity",
  "POST /schedular/check-raffle-status":
    "controllers/scheduler.checkRaffleStatus",
  "POST /schedular/expiring-user-ban": "controllers/scheduler.expireUserBan",
  "POST /schedular/generate-mystery-boxes":
    "controllers/scheduler.generateMysteryBoxPrizes",
  "POST /schedular/validateStoreUserPurchase":
    "controllers/scheduler.validateStoreUserPurchase",
  "POST /schedular/reset-mission-assignments":
    "controllers/scheduler.resetMission",
  "POST /schedular/test-midtrans-disbursement":
    "controllers/scheduler.testMidtransDisbursement",
  "POST /schedular/redis-set-winners-data":
    "controllers/scheduler.redisSetWinnersData",
  "POST /schedular/reassign-quest-preset":
    "controllers/scheduler.reassignQuestPreset",
  "POST /prizepools": "controllers/prizepool.prizepoolInit",
  "GET /prizepools/leaderboard/{type}":
    "controllers/prizepool.getLeaderBoardPrizepool",
  "GET /games/{gameId}/tutorials": "controllers/game.getGameTutorials",
  "POST /tests/notif": "controllers/test.testNotif",
  "POST /test/receive-sns": "controllers/test.receiveSNS",
  "POST /test/send-compute": "controllers/test.sendCompute",
  "POST /test/duitku/inquiry": "controllers/test.duitkuInquiry",
  "POST /test/duitku/transfer": "controllers/test.duitkuTransfer",
  "GET /test/midtrans/accountvalidation":
    "controllers/test.midtransAccountValidation",
  "POST /test/midtrans/createpayout": "controllers/test.midtransCreatePayout",
  "POST /test/midtrans/approvepayout": "controllers/test.midtransApprovePayout",
  "POST /test/raffle/queue": "controllers/test.testRaffleQueueSend",
  "POST /test/awd/prepaid": "controllers/test.testAWDPrepaid",
  "GET /banks": "controllers/bank.getListOfBanks",
  "POST /banks/check-account": "controllers/bank.checkBankAccount",
  "GET /operators": "controllers/operator.getOperatorsProducts",
  "PUT /user-verifications/{verificationId}/status":
    "controllers/user.updateVerificationStatus",
  "GET /app-configs": "controllers/common.getApplicationConfigurations",
  "GET /awd/webhook": "controllers/webhooks.awdCallback",
  "GET /testinvoke": "controllers/test.testGetNotif",
  "GET /aris/tekuton": "controllers/auth.arisTekuton",
  "POST /v1.0/debit/notify": "controllers/webhooks.gopayPaymentNotification",
  // "POST /auths/register/resend": "controllers/auth.resendRegistrationOtp",
  // "POST /auths/register/confirm": "controllers/auth.confirmRegistration",
  // "POST /schedular/reset-stamina": "controllers/scheduler.resetStamina",
};

const privateAdminRoutes: any = {
  "PUT /admin/users/{userId}": "controllers/admin/user.updateUserById",
  "GET /admin/lucky-wheels": "controllers/admin/lucky-wheels.luckyWheelList",
  "GET /admin/lucky-wheels/{luckyWheelId}":
    "controllers/admin/lucky-wheels.luckyWheelDetail",
  "POST /admin/lucky-wheels": "controllers/admin/lucky-wheels.createLuckyWheel",
  "PUT /admin/lucky-wheels/{luckyWheelId}":
    "controllers/admin/lucky-wheels.updateLuckyWheel",
  "DELETE /admin/lucky-wheels/{luckyWheelId}":
    "controllers/admin/lucky-wheels.deleteLuckyWheel",
  "POST /admin/lucky-wheels/{luckyWheelId}/add-prize":
    "controllers/admin/lucky-wheels.createLuckyWheelPrizes",
  "PUT /admin/lucky-wheel-prizes/{luckyWheelPrizeId}":
    "controllers/admin/lucky-wheels.updateLuckyWheelPrizes",
  "DELETE /admin/lucky-wheel-prizes/{luckyWheelPrizeId}":
    "controllers/admin/lucky-wheels.deleteLuckyWheelPrizes",
  "POST /admin/ban/user": "controllers/admin/user.adminBanUser",
  "POST /admin/un-ban/user": "controllers/admin/user.adminUnBanUser",
  "GET /admin/analytic/user": "controllers/admin/user.getUserAnalytic",
  "GET /admin/analytic/game": "controllers/admin/game.getGameAnalytic",
  "GET /admin/users": "controllers/admin/user.getAllUsers",
  "GET /admin/duitku-log/user": "controllers/admin/duitku.fetchUserDuitkuLogs",
  "GET /admin/awd-log/user": "controllers/admin/awd.fetchUserAwdLogs",
  "POST /admin/partners": "controllers/admin/partner.addNewpartner",
  "GET /admin/transaction-log/user":
    "controllers/admin/transaction.userHistoryLogTransaction",
  "POST /admin/partner/ads": "controllers/admin/partner.addNewAdForPartner",
  "GET /admin/raffle-log-winners/user":
    "controllers/admin/raffle.userHistoryLogRaffleWinners",
  "GET /admin/users-revenue-detail":
    "controllers/admin/revenue.usersRevenueDetail",
  "GET /admin/users-withdraw-detail":
    "controllers/admin/user.userWithdrawDetail",
  "GET /admin/lucky-wheels-analytic":
    "controllers/admin/lucky-wheels.getLuckyWheelAnalytic",
  "GET /admin/lucky-wheels-log":
    "controllers/admin/lucky-wheels.getLuckyWheelLog",
};

const privateRoutes: any = {
  "POST /auths/forgot-password": "controllers/auth.forgotPasswordConfirm",
  "GET /auths": "controllers/auth.getAuth",
  "GET /auths/transactions": "controllers/auth.getAuthTransactions",
  "POST /auths/affiliate": "controllers/auth.addAuthAffiliate",
  // "PUT /auths/withdraw/{platform}": "controllers/auth.userWithdrawHandler",
  "POST /auths/account-validation/gopay":
    "controllers/auth.userAccountValidationGopay",
  // "POST /auths/withdraw/gopay": "controllers/auth.userWithdrawGopay",
  // "POST /auths/summary/gopay": "controllers/auth.userSummaryGopay",
  "POST /auths/withdraw/{platform}": "controllers/auth.userWithdrawHandler",
  "POST /auths/summary/{type}": "controllers/auth.userSummaryHandler",
  "GET /auths/affiliate": "controllers/auth.getAffiliateStatus",
  "POST /auths/logout": "controllers/auth.logout",
  "GET /auths/commissions": "controllers/auth.getAuthCommissions",
  "GET /auths/bank-account": "controllers/auth.getAuthUserBank",
  "POST /auths/bank-account": "controllers/auth.storeAuthUserBank",
  "GET /auths/prizes": "controllers/auth.getAuthPrize",
  "PUT /auths/prizes/{userExtPrizeId}/claim": "controllers/auth.authPrizeClaim",
  "POST /auths/verifications": "controllers/auth.authStoreVerification",
  "GET /auths/friends": "controllers/friend.authGetFriendList",
  "GET /auths/friends/search": "controllers/friend.authSearchNotFriend",
  "POST /auths/friends/add": "controllers/friend.authAddFriend",
  "POST /auths/friends/reject": "controllers/friend.authRejectFriend",
  "POST /auths/friends/approve": "controllers/friend.authApproveFriend",
  "POST /auths/friends/remove": "controllers/friend.authRemoveFriend",
  "POST /auths/add-pin/{action}": "controllers/auth.authAddPin",
  "POST /auths/forgot-pin/{action}": "controllers/auth.authRequestForgotPin",
  "POST /auths/pin/{action}": "controllers/auth.authChangePin",
  "GET /home/{dataType}": "controllers/home.getUserDashboardData",
  "POST /lucky-wheels/reset-entries":
    "controllers/lucky-wheels.resetSpinEntries",
  "PUT /daily-logins/claim": "controllers/daily-login.claim",
  "PUT /referrals/claim": "controllers/referrals.userClaim",
  "PUT /affiliates/upgrade/{affiliateUpgradeId}/status":
    "controllers/affiliate.updateAffiliateUpgradeStatus",
  "GET /missions/{missionId}/status": "controllers/mission.getMissionStatus",
  "PUT /missions/{missionId}/{action}":
    "controllers/mission.userMissionHandler",
  "POST /missions/{missionId}/start": "controllers/mission.startingMission",
  "POST /missions/{missionId}/ad-mission-view-confirmation":
    "controllers/mission.adMissionViewConfirmation",
  "POST /missions/{missionId}/reset": "controllers/mission.resetMission",
  "GET /quests/{questId}/status": "controllers/quest.getQuestStatus",
  "PUT /quests/claim-completion": "controllers/quest.userClaimCompleteQuest",
  "PUT /quests/{questId}/finish": "controllers/quest.finishingQuest",
  "POST /quests/{questId}/start": "controllers/quest.startingQuest",
  "POST /quests/{questId}/ad-quest-view-confirmation":
    "controllers/quest.adQuestViewConfirmation",
  "PUT /freeplay/{gameId}/finish": "controllers/freeplay.finishingFreeplay",
  "POST /ads/log": "controllers/ads-log.logging",
  "GET /in-app-purchases/products":
    "controllers/in-app-purchase.getInAppProducts",
  "POST /in-app-purchases": "controllers/in-app-purchase.storeInAppPurchase",
  "PUT /in-app-purchases/{token}/status":
    "controllers/in-app-purchase.updateInAppPurchase",
  "GET /raffles": "controllers/raffle.getRaffles",
  "GET /raffles/{raffleId}": "controllers/raffle.getRaffleDetail",
  "PUT /raffles/{raffleId}/submit": "controllers/raffle.submitRaffle",
  "GET /prizepools/histories":
    "controllers/prizepool.getPrizepoolParticipations",
  "GET /prizepools": "controllers/prizepool.homePrizepools",
  "GET /prizepools/{prizepoolId}/winners":
    "controllers/prizepool.getPrizepoolWinners",
  "POST /games/{gameId}/score": "controllers/game.storeUserGameScore",
  "POST /operators/check": "controllers/operator.operatorCheckBilling",
  "POST /operators/purchase": "controllers/operator.purchasedByUser",
  "GET /partner/ads": "controllers/partner.getRandomPartnerAd",
  "PUT /mystery-box/claim": "controllers/mystery-box.userClaimMysteryBox",
  "PUT /auths/username/change": "controllers/auth.authChangeUsername",
  "POST /in-app-purchases/create-payment":
    "controllers/in-app-purchase.createPayment",
  "GET /rewarded-ads": "controllers/rewarded-ads.getRewardedAds",
  "PUT /rewarded-ads/{rewardedAdsId}/finish":
    "controllers/rewarded-ads.finishingRewardedAds",
  "GET /vip/quests": "controllers/vip.getVipQuests",
  "PUT /vip/quests/{questId}/finish": "controllers/vip.finishingVipQuest",
  "GET /vip/rewards": "controllers/vip.getVipRewards",
  "PUT /vip/rewards/{vipRewardId}/finish": "controllers/vip.finishingVipReward",
  // "PUT /missions/{missionId}/claim-completion": "controllers/mission.userClaimCompleteGameMission",
  // "PUT /missions/{missionId}/finish": "controllers/mission.finishingMission",
  // "PUT /auths/withdraw/e-wallet": "controllers/auth.userWithdrawEWallet",
  // "PUT /auths/withdraw/bank": "controllers/auth.userWithdrawBank",
};

// Unified private handler
const privateHandler = async (
  event: lambda.APIGatewayProxyEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<lambda.APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  let path = event.path;
  const basePath = "/production";
  if (path.startsWith(basePath)) {
    path = path.substring(basePath.length);
  }

  const routeKey = `${httpMethod} ${path}`;
  console.log(`Accessing ${routeKey}`);
  const handlerPath = matchRoute(privateRoutes, routeKey, httpMethod, path);
  if (!handlerPath) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: `No handler found for route ${routeKey}`,
      }),
    };
  }

  const [modulePath, functionName] = handlerPath.split(".");
  console.log(
    `Module path: ${modulePath}, Function name: ${functionName}, Handler path: ${handlerPath}`
  );
  // const params = {
  //     FunctionName: functionName,
  //     Payload: JSON.stringify(event),
  // }
  try {
    // const response = await awslambda.invoke(params).promise();
    const module: any = await import(`./${modulePath}`);
    const response = await module[functionName](event, context, callback);
    return response;
  } catch (error: any) {
    console.error(`Error invoking Lambda function ${functionName}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        status: 500,
        data: {
          error: error.toString(),
        },
      }),
    };
  }
};

// Unified public handler
const publicHandler = async (
  event: lambda.APIGatewayProxyEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<lambda.APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  let path = event.path;
  const basePath = "/production";
  if (path.startsWith(basePath)) {
    path = path.substring(basePath.length);
  }

  const routeKey = `${httpMethod} ${path}`;
  console.log(`Accessing ${routeKey}`);
  const handlerPath = matchRoute(publicRoutes, routeKey, httpMethod, path);
  if (!handlerPath) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: `No handler found for public route ${routeKey}`,
      }),
    };
  }

  const [modulePath, functionName] = handlerPath.split(".");
  // const params = {
  //     FunctionName: functionName,
  //     Payload: JSON.stringify(event),
  // }
  try {
    // const response = await awslambda.invoke(params).promise();
    const module: any = await import(`./${modulePath}`);
    const response = await module[functionName](event, context, callback);
    return response;
  } catch (error: any) {
    console.error(`Error invoking Lambda function ${functionName}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        status: 500,
        data: {
          error: error.toString(),
        },
      }),
    };
  }
};

// Unified private admin handler
const privateAdminHandler = async (
  event: lambda.APIGatewayProxyEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<lambda.APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  let path = event.path;
  const routeKey = `${httpMethod} ${path}`;
  const basePath = "/production";
  if (path.startsWith(basePath)) {
    path = path.substring(basePath.length);
  }

  console.log(`Accessing ${routeKey}`);
  const handlerPath = matchRoute(
    privateAdminRoutes,
    routeKey,
    httpMethod,
    path
  );
  if (!handlerPath) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: `No handler found for route ${routeKey}`,
      }),
    };
  }

  const [modulePath, functionName] = handlerPath.split(".");
  // const params = {
  //     FunctionName: functionName,
  //     Payload: JSON.stringify(event),
  // }
  try {
    // const response = await awslambda.invoke(params).promise();
    const module: any = await import(`./${modulePath}`);
    const response = await module[functionName](event, context, callback);
    return response;
  } catch (error: any) {
    console.error(`Error invoking Lambda function ${functionName}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        status: 500,
        data: {
          error: error.toString(),
        },
      }),
    };
  }
};

const matchRoute = (
  routes: any,
  routeKey: string,
  method: string,
  path: string
) => {
  // Check for exact match
  if (routes[routeKey]) return routes[routeKey];

  // Check for dynamic parameters
  for (const [route, handler] of Object.entries(routes)) {
    const [routeMethod, routePath] = route.split(" ");

    if (routeMethod === method) {
      // Create a regex pattern from the route path to match dynamic parameters (e.g., {room_id}, {slug})
      const routeRegex = new RegExp(
        "^" +
          routePath.replace(/{([^}]+)}/g, "([^/]+)") + // Replace {param} with regex to capture multiple parameters
          "$"
      );

      const match = routeRegex.exec(path);
      if (match) {
        // Optionally, you can extract matched parameters if you need them
        const params = [...match].slice(1); // Remove the full match (first element)
        return handler; // Return both handler and params if needed
      }
    }
  }

  return undefined; // Route not found
};

exports.privateHandler = new MiddlewareWrapper().init(privateHandler, [
  unfiedHandlerMiddleware(),
]);
exports.publicHandler = new MiddlewareWrapper().init(publicHandler, [
  unfiedHandlerMiddleware(),
]);
exports.privateAdminHandler = new MiddlewareWrapper().init(
  privateAdminHandler,
  [unfiedHandlerMiddleware()]
);
