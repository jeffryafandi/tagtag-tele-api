import * as lambda from "aws-lambda";
// import { isNumber } from 'underscore';
import { ResponseService } from "../services/response";
import {
  AllResponse,
  authResponse,
  BaseResponse,
} from "../interfaces/generals/response";
import { Database } from "../database";
import { HelperService } from "../services/helper";
import { UserService } from "../services/user";
import { EmailService } from "../services/email";
import { AuthService } from "../services/auth";
import { QuestService } from "../services/quest";
import { MissionService } from "../services/mission";
import { Validator } from "../validators/base";
import {
  RegisterRules,
  ResendRegistrationOtpRules,
  ConfirmRegistrationRules,
  LoginWithUsernameAndPasswordRules,
  ForgotPasswordRules,
  CheckForgotPasswordTokenRules,
  ResetPasswordRules,
  LoginWithGoogleIdRules,
  ChangeEmailOTPRules,
  ChangeEmailRules,
  ChangePasswordRules,
  ChangeAddressRules,
  AddAuthAffiliateRules,
  UsernameCheck,
  EmailCheck,
  UserWithdrawRules,
  ForgotPasswordConfirmRules,
  AuthCommissionQuery,
  CreateUserBankRules,
  UserClaimRules,
  AuthWithdrawEWalletRules,
  StoreVerificationRules,
  AuthTransactionParamsRules,
  CreatedAt,
  AuthAddPinRules,
  VerifyAddPinRules,
  ForgotPinRules,
  CheckPinRules,
  ChangePinRules,
  AccountValidationGopayRules,
  SummaryGopayRules,
  UserWithdrawGopayRules,
  LoginWithGopayIdRules,
  SummaryGopayIdRules,
  UserWithdrawGopayIdRules,
  CheckUsernameRules,
  LoginWithTelegramRules,
} from "../validators/auth";
import { Users } from "../entities/users";
import { LuckyWheelsService } from "../services/lucky-wheels";
import {
  AFFILIATE_BENEFIT_ID,
  TRANSACTION_DESCRIPTIONS,
  MAX_USERNAME_CHAR,
  QUEST_PRESET_VIP_ID,
  QUEST_PRESET_REGULAR_ID,
  MISSION_PRESET_VIP_ID,
  MISSION_PRESET_REGULAR_ID,
} from "../config/constants";
import {
  AuthChangePinRequest,
  AuthForgotPinRequest,
  ForgotPasswordChangeRequest,
  VerifyAddPinRequest,
  LoginWithGopayIdRequest,
  LoginWithTelegramRequest,
} from "../interfaces/requests/auth";
import { RevenueService } from "../services/revenue";
import {
  CreateUser,
  CreateUserBankRequest,
  CreateUserGoogleIdRequest,
  UserVerificationStatusEnum,
  UserWithdrawStatus,
  CreateUserGopayIdRequest,
} from "../interfaces/requests/users";
import { BankService } from "../services/bank";
import { AffiliateService } from "../services/affiliate";
import { TransactionAvailableCodeEnum } from "../interfaces/requests/transaction";
import { isNumber } from "class-validator";
import { PusherService } from "../services/pusher";
import { UserActivityService } from "../services/user-activity";
import { FriendActivityStatusEnum } from "../interfaces/requests/friend";
import { EVENT_NAME } from "../config/pusher-constant";
import { TelegramService } from "../services/telegram";
import { checkBannedMiddleware } from "../middleware/check-ban-middleware";
import { MiddlewareWrapper } from "../middleware";
import { MidtransService } from "../services/midtrans";
import {
  MidtransAccountValidationRequest,
  MidtransCreatePayoutRequest,
  MidtransApproveRequestRequest,
  MidtransCustomerTopupRequest,
  CustomerTopupValueRequest,
  CustomerTopUpAdditionalInfoRequest,
} from "../interfaces/requests/midtrans";
import { AppConfigService } from "../services/app-config";
import { NOTIF_CODE } from "../config/notif-constant";
import { NotificationService } from "../services/fcm-notification";
import {
  TransactionDetailCurrencyEnum,
  TransactionDetailRequest,
} from "../interfaces/requests/transaction";
import { TransactionService } from "../services/transaction";
import { UserRequestService } from "../services/user-request";
import dayjs from "dayjs";
import { checkForceUpdateMiddleware } from "../middleware/check-force-update";
import { checkXApiSecretMiddleware } from "../middleware/check-x-api-secret";
import axios from "axios";
import { VipService } from "../services/vip";
import crypto from "crypto";

const database = new Database();
const helperService = new HelperService();
export const notFound: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  return ResponseService.baseResponseJson(404, "Cari apa sih", null);
};
export const ping: lambda.Handler = async (
  event: lambda.APIGatewayTokenAuthorizerEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  return ResponseService.baseResponseJson(200, "ping successfully", {
    data: "PONG!",
  });
};

export const arisTekuton: lambda.Handler = async (
  event: lambda.APIGatewayTokenAuthorizerEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  return ResponseService.baseResponseJson(200, "aris trkuton", {
    data: "HELLO WORLD!",
  });
};
export const testIp: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
) => {
  console.log("TRIIGGERED");
  const res = await axios.get("https://api64.ipify.org?format=json");
  return {
    statusCode: 200,
    body: JSON.stringify({ ip: res.data.ip }),
  };
};
export const auth: lambda.Handler = async (
  event: lambda.APIGatewayTokenAuthorizerEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<authResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);
  const userActivityService = new UserActivityService(connection);
  const pusherService = new PusherService();

  const rawToken: string = event.authorizationToken;

  if (rawToken == undefined || rawToken == "") {
    return authService.generatePolicy(
      event.authorizationToken,
      "Deny",
      event.methodArn
    );
  }

  const token = authService.sanitizeRawToken(rawToken);

  // Check Hook Token
  const hookToken = process.env.HOOK_TOKEN;
  if (token == hookToken) {
    return authService.generatePolicy(
      event.authorizationToken,
      "Allow",
      event.methodArn
    );
  }
  // End Check Hook Token

  // Check Token
  const validUser = await authService.isTokenValid(token);
  if (validUser) {
    try {
      if (validUser.bans.length === 0) {
        await pusherService.publish(
          `user-event`,
          `${EVENT_NAME.activity}:${validUser.id}`,
          {
            data: {
              user: {
                id: validUser.id,
                username: validUser.username,
              },
              status: FriendActivityStatusEnum.online,
            },
          }
        );
        await userActivityService.updateUserActivityConnection(
          validUser.id,
          FriendActivityStatusEnum.online
        );
      }
    } catch (error) {
      console.log("error", error);
    }
    return authService.generatePolicy(
      event.authorizationToken,
      "Allow",
      event.methodArn
    );
  }

  return authService.generatePolicy(
    event.authorizationToken,
    "Deny",
    event.methodArn
  );
};

export const register: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);
  const userService = new UserService(connection);
  const emailService = new EmailService();
  const telegramService = new TelegramService();
  const affiliateService = new AffiliateService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(RegisterRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }

  const validateRegistration = await authService.validateRegistration(
    parsedBody
  );
  if (validateRegistration == -1) {
    return ResponseService.baseResponseJson(
      422,
      "Password and password confirmation not matches",
      null
    );
  } else if (validateRegistration == -2) {
    return ResponseService.baseResponseJson(
      422,
      "Email or username is already existed",
      null
    );
  }

  /** Generate OTP Token */
  const confirmOtpToken = helperService.generateConfirmOtpToken();
  parsedBody.confirm_otp_token = confirmOtpToken;

  const user = await userService.createUser(parsedBody);

  if (user == undefined) {
    return ResponseService.baseResponseJson(
      422,
      "Create user failed. Please check logs.",
      null
    );
  }

  if (parsedBody.referrer_username) {
    const referrer = await userService.getUserByUsername(
      parsedBody.referrer_username
    );
    if (referrer) {
      if (referrer.affiliate) {
        await affiliateService.assignUserToAffiliator(referrer.affiliate, user);
        await userService.giveAffiliateBonusToUser(user);
      }

      const addUserReferralPrize = await userService.addUserReferralPrize({
        user: referrer,
        referred_user_id: user.id,
      });

      if (isNumber(addUserReferralPrize)) {
        switch (addUserReferralPrize) {
          default:
            return ResponseService.baseResponseJson(
              422,
              "Something is wrong",
              null
            );
        }
      }
    }
  }
  // end checking username exist or not
  //  Add Refferal Prize
  // End add referral prize
  /** Send OTP to Created User */
  await emailService.sendRegistrationOtp(user);
  return ResponseService.baseResponseJson(200, "Register successfully", {
    email: user.email,
  });
};

export const authCheckUsername: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(UsernameCheck);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }

  const authCheckUsername = await authService.authCheckUsername(parsedBody);
  if (authCheckUsername == -1) {
    return ResponseService.baseResponseJson(
      422,
      "Username Already Exist!",
      null
    );
  }
  // End Validate Payload

  return ResponseService.baseResponseJson(200, "Register successfully", {
    is_available: true,
  });
};

export const authCheckEmail: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(EmailCheck);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }

  const authCheckEmail = await authService.authCheckEmail(parsedBody);
  if (authCheckEmail == -1) {
    return ResponseService.baseResponseJson(422, "Email Already Exist!", null);
  }
  // End Validate Payload

  return ResponseService.baseResponseJson(200, "Register successfully", {
    is_available: true,
  });
};

export const authRegistartionHandler: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const handlers = {
      resend: resendRegistrationOtp,
      confirm: confirmRegistration,
    } as any;
    const apiPath = event.pathParameters;

    if (apiPath && apiPath.action) {
      if (!["confirm", "resend"].includes(apiPath.action))
        throw Error(
          "Invalid action it should be between `confirm` and `resend`"
        );
      if (Object.keys(handlers).includes(apiPath.action)) {
        return await handlers[apiPath.action](event);
      }
    }
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

const resendRegistrationOtp: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);
  const emailService = new EmailService();

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(ResendRegistrationOtpRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }
  // End Validate Payload

  /** Generate OTP Token */
  const user = await userService.getUserByEmailAndPassword(
    parsedBody.email,
    parsedBody.password
  );

  if (user == null) {
    return ResponseService.baseResponseJson(422, "User not found", null);
  }

  /** Send OTP to the User */
  await emailService.sendRegistrationOtp(user);

  return ResponseService.baseResponseJson(
    200,
    "Confirm code re-sent successfully",
    null
  );
};

const confirmRegistration: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);
  const userService = new UserService(connection);
  const questService = new QuestService(connection);
  const missionService = new MissionService(connection);
  const luckyWheelsService = new LuckyWheelsService(connection);
  const userActivityService = new UserActivityService(connection);
  const pusherService = new PusherService();

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(ConfirmRegistrationRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }
  // End Validate Payload

  /** Get User By Email */
  const user = await userService.getUserByEmail(parsedBody.email);

  if (user == null) {
    return ResponseService.baseResponseJson(422, "User not found", null);
  }

  // Validate Registration Confirmation
  const validateRegistration =
    await authService.validateRegistrationConfirmation(
      user,
      parsedBody.confirm_otp_token
    );
  if (validateRegistration == -1) {
    return ResponseService.baseResponseJson(422, "OTP Token is invalid", null);
  }
  // End Validate Registration Confirmation

  /** Confirm Registration */
  const confirmRegistration = await authService.confirmRegistration(user);

  /**
   * Handle Assign Quest and Mission and LuckyWheel and assign to affiliate
   *
   */
  await questService.insertUserQuestPreset({
    user_id: user.id,
    preset_id: QUEST_PRESET_REGULAR_ID,
  });
  await missionService.insertUserMissionPreset({
    user_id: user.id,
    preset_id: MISSION_PRESET_REGULAR_ID,
  });
  await questService.assignInitialQuest(user.id, [], QUEST_PRESET_REGULAR_ID);
  await missionService.assignInitialMission(user.id, MISSION_PRESET_REGULAR_ID);
  await luckyWheelsService.createNewLuckyWheelSessions(user.id);
  await userService.addAuthAffiliate(user, {
    name: user.name,
    email: user.email,
    affiliate_benefit_id: AFFILIATE_BENEFIT_ID,
  });
  try {
    const userActivityConnection =
      await userActivityService.findUserActivityConnection(
        Number(confirmRegistration.user_id)
      );
    if (!userActivityConnection) {
      await userActivityService.storeUserActivityConnection(
        Number(confirmRegistration.user_id)
      );
    }
    await pusherService.publish(
      `user-event`,
      `${EVENT_NAME.activity}:${user.id}`,
      {
        data: {
          user: {
            id: user.id,
            username: user.username,
          },
          status: FriendActivityStatusEnum.online,
        },
      }
    );
    await userActivityService.updateUserActivityConnection(
      Number(user.id),
      FriendActivityStatusEnum.online
    );
  } catch (error) {
    console.log("error", error);
  }

  return ResponseService.baseResponseJson(
    200,
    "Registration confirmed",
    confirmRegistration
  );
};

export const loginWithUsernameAndPassword: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);
  const pusherService = new PusherService();
  const userActivityService = new UserActivityService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(LoginWithUsernameAndPasswordRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }
  // End Validate Payload

  try {
    const login = await authService.loginWithUsernamePassword({
      email: parsedBody.email,
      password: parsedBody.password,
    });

    if (login.status == 0) {
      return ResponseService.baseResponseJson(
        403,
        "Your account is linked with google account!",
        null
      );
    } else if (login.status == -1) {
      return ResponseService.baseResponseJson(
        422,
        "Password is incorrect!",
        null
      );
    } else if (login.status == -2) {
      return ResponseService.baseResponseJson(
        422,
        "User registration is not completed",
        { is_registration_complete: false }
      );
    } else if (login.status == -99) {
      let errorData: any = {
        code: 99,
        message: "banned",
      };

      if (login.user_id) {
        const bans = await authService.userService.fetchBansByUserId(
          login.user_id
        );
        const expiredAt = bans.map((ban) => {
          if (!ban.expired_in) return 0;
          const created = helperService.toDateTime(dayjs(ban.created_at));
          const expired = dayjs(
            helperService.addHours(created, ban.expired_in)
          ).valueOf();
          return expired;
        });
        expiredAt.sort((a, b) => b - a);
        const hasPermanent = expiredAt.findIndex((time) => time == 0);
        if (hasPermanent < 0) {
          errorData = { ...errorData, expired_at: expiredAt[0] };
        }
      }

      return ResponseService.baseResponseJson(
        401,
        "Whoops! It looks like someone doing something bad :D",
        errorData
      );
    }

    try {
      const userActivityConnection =
        await userActivityService.findUserActivityConnection(
          Number(login.user_id)
        );
      if (!userActivityConnection) {
        await userActivityService.storeUserActivityConnection(
          Number(login.user_id)
        );
      }
      await pusherService.publish(
        `user-event`,
        `${EVENT_NAME.activity}:${login.user_id}`,
        {
          data: {
            user: {
              id: login.user_id,
              username: login.username,
            },
            status: FriendActivityStatusEnum.online,
          },
        }
      );
      await userActivityService.updateUserActivityConnection(
        Number(login.user_id),
        FriendActivityStatusEnum.online
      );
    } catch (error) {
      console.log("error", error);
    }

    return ResponseService.baseResponseJson(200, "Login successfull", login);
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const loginWithGopayId: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  try {
    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const midtransService = new MidtransService(connection);
    const userService = new UserService(connection);
    const questService = new QuestService(connection);
    const missionService = new MissionService(connection);
    const luckyWheelsService = new LuckyWheelsService(connection);
    const affiliateService = new AffiliateService(connection);
    const userActivityService = new UserActivityService(connection);
    const pusherService = new PusherService();

    if (!event.body) {
      return ResponseService.baseResponseJson(
        422,
        "Payload must be filled",
        null
      );
    }

    let parsedBody: CreateUserGopayIdRequest;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (error) {
      return ResponseService.baseResponseJson(
        422,
        "Payload is incorrect. Please check logs",
        null
      );
    }

    const validator = new Validator(LoginWithGopayIdRules);
    const validate = await validator.validate(parsedBody);

    if (!validate.status)
      return ResponseService.baseResponseJson(422, validate.message, null);

    // call gopay backend
    const miniAppTokenResponse = await midtransService.miniAppToken(
      parsedBody.auth_code
    );
    if (!miniAppTokenResponse.success) {
      return ResponseService.baseResponseJson(
        422,
        "MiniApp Gopay Token is failed",
        { error: true }
      );
    }

    const gopay_id = miniAppTokenResponse.data.data.gopay_account_id;

    const gopayIdBody: LoginWithGopayIdRequest = {
      gopay_id: gopay_id,
    };

    const existedUser = await authService.validateGopayIdRegistration(
      gopayIdBody
    );

    if (!existedUser) {
      const registeredUser = await userService.createUserGopayId(gopay_id);

      await questService.insertUserQuestPreset({
        user_id: registeredUser.id,
        preset_id: QUEST_PRESET_REGULAR_ID,
      });
      await missionService.insertUserMissionPreset({
        user_id: registeredUser.id,
        preset_id: MISSION_PRESET_REGULAR_ID,
      });
      await questService.assignInitialQuest(
        registeredUser.id,
        [],
        QUEST_PRESET_REGULAR_ID
      );
      await missionService.assignInitialMission(
        registeredUser.id,
        MISSION_PRESET_REGULAR_ID
      );
      await luckyWheelsService.createNewLuckyWheelSessions(registeredUser.id);
      await userService.addAuthAffiliate(registeredUser, {
        name: registeredUser.name,
        email: registeredUser.email,
        affiliate_benefit_id: AFFILIATE_BENEFIT_ID,
      });
    }

    /** Get User By gopay_id */
    const login = await authService.gopaySignin(gopay_id);

    if (login.status == -1) {
      return ResponseService.baseResponseJson(
        422,
        "User not found, please check your gopay account",
        null
      );
    } else if (login.status == -99) {
      let errorData: any = {
        code: 99,
        message: "banned",
      };

      if (login.user_id) {
        const bans = await authService.userService.fetchBansByUserId(
          login.user_id
        );
        const expiredAt = bans.map((ban) => {
          if (!ban.expired_in) return 0;
          const created = helperService.toDateTime(dayjs(ban.created_at));
          const expired = dayjs(
            helperService.addHours(created, ban.expired_in)
          ).valueOf();
          return expired;
        });
        expiredAt.sort((a, b) => b - a);
        const hasPermanent = expiredAt.findIndex((time) => time == 0);
        if (hasPermanent < 0) {
          errorData = { ...errorData, expired_at: expiredAt[0] };
        }
      }

      return ResponseService.baseResponseJson(
        401,
        "Whoops! It looks like someone doing something bad :D",
        errorData
      );
    }

    try {
      const userActivityConnection =
        await userActivityService.findUserActivityConnection(
          Number(login.user_id)
        );
      if (!userActivityConnection) {
        await userActivityService.storeUserActivityConnection(
          Number(login.user_id)
        );
      }
      await pusherService.publish(
        `user-event`,
        `${EVENT_NAME.activity}:${login.user_id}`,
        {
          data: {
            user: {
              id: login.user_id,
              username: login.username,
            },
            status: FriendActivityStatusEnum.online,
          },
        }
      );
      await userActivityService.updateUserActivityConnection(
        Number(login.user_id),
        FriendActivityStatusEnum.online
      );
    } catch (error) {
      console.log("error", error);
    }

    return ResponseService.baseResponseJson(200, "Login successfull", login);
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const loginWithGoogleId: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  try {
    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const userService = new UserService(connection);
    const questService = new QuestService(connection);
    const missionService = new MissionService(connection);
    const luckyWheelsService = new LuckyWheelsService(connection);
    const affiliateService = new AffiliateService(connection);
    const userActivityService = new UserActivityService(connection);
    const pusherService = new PusherService();

    if (!event.body) {
      return ResponseService.baseResponseJson(
        422,
        "Payload must be filled",
        null
      );
    }

    let parsedBody: CreateUserGoogleIdRequest;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (error) {
      return ResponseService.baseResponseJson(
        422,
        "Payload is incorrect. Please check logs",
        null
      );
    }

    const validator = new Validator(LoginWithGoogleIdRules);
    const validate = await validator.validate(parsedBody);

    if (!validate.status)
      return ResponseService.baseResponseJson(422, validate.message, null);

    const existedUser = await authService.validateGoogleIdRegistration(
      parsedBody
    );

    if (!existedUser) {
      const registeredUser = await userService.createUserGoogleId(parsedBody);

      await questService.insertUserQuestPreset({
        user_id: registeredUser.id,
        preset_id: QUEST_PRESET_REGULAR_ID,
      });
      await missionService.insertUserMissionPreset({
        user_id: registeredUser.id,
        preset_id: MISSION_PRESET_REGULAR_ID,
      });
      await questService.assignInitialQuest(
        registeredUser.id,
        [],
        QUEST_PRESET_REGULAR_ID
      );
      await missionService.assignInitialMission(
        registeredUser.id,
        MISSION_PRESET_REGULAR_ID
      );
      await luckyWheelsService.createNewLuckyWheelSessions(registeredUser.id);
      await userService.addAuthAffiliate(registeredUser, {
        name: registeredUser.name,
        email: registeredUser.email,
        affiliate_benefit_id: AFFILIATE_BENEFIT_ID,
      });

      return ResponseService.baseResponseJson(200, "Register successfull", {
        api_token: null,
      });
    } else {
      if (parsedBody.referrer_username) {
        const referrer = await userService.getUserByUsername(
          parsedBody.referrer_username
        );
        if (!referrer) {
          return ResponseService.baseResponseJson(
            422,
            "Referrer user not found",
            null
          );
        }

        if (referrer.affiliate) {
          await affiliateService.assignUserToAffiliator(
            referrer.affiliate,
            existedUser
          );
          await userService.giveAffiliateBonusToUser(existedUser);
        }
      }

      await userService.saveUserGoogleId(parsedBody);
    }

    /** Get User By Email & Password */
    const login = await authService.googleSignin({
      email: parsedBody.email,
      username: parsedBody.username,
      google_id: parsedBody.google_id,
    });

    if (login.status == -1) {
      return ResponseService.baseResponseJson(
        422,
        "User not found, please check your email or your google account",
        null
      );
    } else if (login.status == -99) {
      let errorData: any = {
        code: 99,
        message: "banned",
      };

      if (login.user_id) {
        const bans = await authService.userService.fetchBansByUserId(
          login.user_id
        );
        const expiredAt = bans.map((ban) => {
          if (!ban.expired_in) return 0;
          const created = helperService.toDateTime(dayjs(ban.created_at));
          const expired = dayjs(
            helperService.addHours(created, ban.expired_in)
          ).valueOf();
          return expired;
        });
        expiredAt.sort((a, b) => b - a);
        const hasPermanent = expiredAt.findIndex((time) => time == 0);
        if (hasPermanent < 0) {
          errorData = { ...errorData, expired_at: expiredAt[0] };
        }
      }

      return ResponseService.baseResponseJson(
        401,
        "Whoops! It looks like someone doing something bad :D",
        errorData
      );
    }

    try {
      const userActivityConnection =
        await userActivityService.findUserActivityConnection(
          Number(login.user_id)
        );
      if (!userActivityConnection) {
        await userActivityService.storeUserActivityConnection(
          Number(login.user_id)
        );
      }
      await pusherService.publish(
        `user-event`,
        `${EVENT_NAME.activity}:${login.user_id}`,
        {
          data: {
            user: {
              id: login.user_id,
              username: login.username,
            },
            status: FriendActivityStatusEnum.online,
          },
        }
      );
      await userActivityService.updateUserActivityConnection(
        Number(login.user_id),
        FriendActivityStatusEnum.online
      );
    } catch (error) {
      console.log("error", error);
    }

    return ResponseService.baseResponseJson(200, "Login successfull", login);
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const getAuth: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse | AllResponse> => {
  const helperService = new HelperService();
  return await helperService.withConnection(async (connection) => {
    try {
      const authService = new AuthService(connection);
      const userService = new UserService(connection);

      const rawToken = event.headers.Authorization;
      if (rawToken == undefined || rawToken == "") {
        return authService.generatePolicy(
          "" + rawToken,
          "Deny",
          event.requestContext.authorizer?.principalId
        );
      }

      const token = authService.sanitizeRawToken(rawToken);

      const user = await userService.getUserByApiToken(token);

      if (user == null) {
        return ResponseService.baseResponseJson(422, "User not found", null);
      }

      const deviceToken =
        event.headers["x-device-token"] ||
        event.headers["X-Device-Token"] ||
        event.headers["X-DEVICE-TOKEN"];

      if (deviceToken) {
        console.log(
          "Update or Create user Device Token using: ===== ",
          deviceToken
        );
        await userService.updateOrReplaceDeviceToken(user, deviceToken);
      }

      const mappedUser = await userService.getMappedAuth(user);
      console.log(
        "RESPONSE",
        ResponseService.baseResponseJson(200, "Login successfull", mappedUser)
      );
      return ResponseService.baseResponseJson(
        200,
        "Login successfull",
        mappedUser
      );
    } catch (error) {
      console.error("ERROR", error);
      return ResponseService.baseResponseJson(500, "Error in the server", {});
    }
  });
};

export const forgotPasswordRequest: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const userService = authService.userService;
    const emailService = new EmailService();

    if (!event.body) throw Error("Payload must be filled!");

    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(ForgotPasswordRules).validate(
      parsedBody
    );
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });
    }

    const user = await userService.getUserByEmail(parsedBody.email);
    if (!user)
      return ResponseService.baseResponseJson(
        422,
        "Email is not registered",
        null
      );

    const otpToken = helperService.generateOTPToken();
    await userService.update(user, { reset_password_token: otpToken });
    const success = await emailService.sendForgotPasswordOtp(user, otpToken);
    return ResponseService.baseResponseJson(
      !success ? 422 : 200,
      `Reset Password Code ${!success ? " is Not " : ""} sent to the Email`,
      {
        email: user.email,
      }
    );
  } catch (error) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: JSON.stringify(error),
    });
  }
};

export const changePasswordRequest: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);
  const userService = new UserService(connection);
  const emailService = new EmailService();

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(ForgotPasswordRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }

  const otpToken = helperService.generateOTPToken();
  /** Set OTP Token */

  const user = await userService.getUserByEmail(parsedBody.email);
  if (user == null) {
    return ResponseService.baseResponseJson(
      422,
      "Email is not registered",
      null
    );
  }

  await authService.setForgotPasswordToken(user, otpToken);

  /** Send OTP to the User */
  await emailService.sendForgotPasswordOtp(user, otpToken);

  return ResponseService.baseResponseJson(
    200,
    "Reset Password Code sent to the Email",
    {
      email: user.email,
    }
  );
};

export const checkChangePasswordToken: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(CheckForgotPasswordTokenRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }

  const user = await userService.getUserByEmailAndForgotPasswordToken(
    parsedBody.email,
    parsedBody.forgot_password_token
  );

  if (user == null) {
    return ResponseService.baseResponseJson(422, "Code invalid", null);
  }

  return ResponseService.baseResponseJson(200, "Code is valid", null);
};

export const resetPassword: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(ResetPasswordRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }

  const user = await userService.getUserByResetPasswordToken(
    parsedBody.reset_password_token
  );
  console.log(user);

  if (user == null) {
    return ResponseService.baseResponseJson(422, "Code invalid", null);
  }

  await userService.updatePassword(
    user,
    parsedBody.old_password,
    parsedBody.new_password,
    parsedBody.new_password_confirmation
  );
  return ResponseService.baseResponseJson(
    200,
    "Password Updated Successfully",
    null
  );
};

export const changeEmailOTP: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse | AllResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);
  const authService = new AuthService(connection);
  const emailService = new EmailService();

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  const rawToken = event.headers.Authorization;
  if (rawToken == undefined || rawToken == "") {
    return authService.generatePolicy(
      "" + rawToken,
      "Deny",
      event.requestContext.authorizer?.principalId
    );
  }

  // Validate Payload
  const validator = new Validator(ChangeEmailOTPRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }
  // End Validate Payload

  const token = authService.sanitizeRawToken(rawToken);

  const user = await userService.getUserByApiToken(token);

  if (user == null) {
    return ResponseService.baseResponseJson(422, "User not found", null);
  }

  const userRequest = await authService.requestChangeEmailByUser(
    user,
    parsedBody.email
  );
  if (userRequest == undefined) {
    return ResponseService.baseResponseJson(
      422,
      "Update email failed or email is already taken",
      null
    );
  }

  /** Send OTP to User */
  await emailService.sendChangeEmailRequestOtp(userRequest);

  return ResponseService.baseResponseJson(
    200,
    "Change email request sent successfully",
    null
  );
};

export const changeEmail: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse | AllResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);
  const authService = new AuthService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  const rawToken = event.headers.Authorization;
  if (rawToken == undefined || rawToken == "") {
    return authService.generatePolicy(
      "" + rawToken,
      "Deny",
      event.requestContext.authorizer?.principalId
    );
  }

  // Validate Payload
  const validator = new Validator(ChangeEmailRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }
  // End Validate Payload

  const token = authService.sanitizeRawToken(rawToken);

  const user = await userService.getUserByApiToken(token);

  if (user == null) {
    return ResponseService.baseResponseJson(422, "User not found", null);
  }

  const confirmEmail = await authService.confirmChangeEmailByUser(
    user,
    parsedBody.otp_token
  );
  if (confirmEmail == false) {
    return ResponseService.baseResponseJson(422, "OTP token is invalid", null);
  }

  return ResponseService.baseResponseJson(
    200,
    "Email change confirmed successfully",
    null
  );
};

export const changePassword: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse | AllResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);
  const authService = new AuthService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  const rawToken = event.headers.Authorization;
  if (rawToken == undefined || rawToken == "") {
    return authService.generatePolicy(
      "" + rawToken,
      "Deny",
      event.requestContext.authorizer?.principalId
    );
  }

  // Validate Payload
  const validator = new Validator(ChangePasswordRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }
  // End Validate Payload

  const token = authService.sanitizeRawToken(rawToken);

  const user = await userService.getUserByApiToken(token);

  if (user == null) {
    return ResponseService.baseResponseJson(422, "User not found", null);
  }

  const changePassword = await authService.changePassword(user, parsedBody);
  switch (changePassword) {
    case -1:
      return ResponseService.baseResponseJson(422, "Password is invalid", null);
    case -2:
      return ResponseService.baseResponseJson(
        422,
        "New password and confirmation password does not match",
        null
      );

    default:
      break;
  }

  return ResponseService.baseResponseJson(
    200,
    "Password changed successfully",
    null
  );
};

export const addAuthAffiliate: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);
  const authService = new AuthService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);

    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(AddAuthAffiliateRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }
  // End Validate Payload

  // Get Logged User
  let user = null;
  const rawToken = event.headers.Authorization;
  if (rawToken != undefined) {
    const token = authService.sanitizeRawToken(rawToken);

    user = await userService.getUserByApiToken(token);
  }

  if (user == null) {
    return ResponseService.baseResponseJson(401, "Token is invalid.", null);
  }
  // End Get Logged User

  const affiliate = await userService.addAuthAffiliate(user, parsedBody);

  if (affiliate === undefined) {
    return ResponseService.baseResponseJson(
      422,
      "Failed to Add Affiliate. Please check logs.",
      null
    );
  }

  if (parsedBody.socials) {
    const socials = parsedBody.socials;
    for (const social of socials) {
      const type = social.type;
      const link = social.link;

      console.log(type);
      console.log(link);

      const addAffiliateSocials = await userService.addAffiliateSocials({
        affiliate: affiliate,
        type: type,
        link: link,
      });

      if (isNumber(addAffiliateSocials)) {
        switch (addAffiliateSocials) {
          default:
            return ResponseService.baseResponseJson(
              422,
              "Something is wrong",
              null
            );
        }
      }
    }
  }

  return ResponseService.baseResponseJson(
    200,
    "Create Affiliate Succesfully",
    {}
  );
};

export const userWithdrawHandler: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const handlers = {
      bank: userWithdrawBank,
      "e-wallet": userWithdrawEWallet,
      gopay: userWithdrawGopay,
      gopay_id: userWithdrawGopayId,
    } as any;
    const apiPath = event.pathParameters;

    if (apiPath && apiPath.platform) {
      if (!["bank", "e-wallet", "gopay", "gopay_id"].includes(apiPath.platform))
        throw Error(
          "Invalid platform! It should be between `e-wallet` and `bank` and `gopay` and `gopay_id`"
        );
      if (Object.keys(handlers).includes(apiPath.platform)) {
        return await handlers[apiPath.platform](event);
      }
    }
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const userWithdrawGopayHandler: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const handlers = {
      gopay: userWithdrawGopay,
      gopay_id: userWithdrawGopayId,
    } as any;
    const apiPath = event.pathParameters;

    if (apiPath && apiPath.type) {
      if (!["gopay", "gopay_id"].includes(apiPath.type))
        throw Error(
          "Invalid type! It should be between `gopay` and `gopay_id`"
        );
      if (Object.keys(handlers).includes(apiPath.type)) {
        return await handlers[apiPath.type](event);
      }
    }
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const userWithdrawGopayId: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await new Database().getConnection();
    const userService = new UserService(connection);
    const transactionService = new TransactionService(connection);
    const authService = new AuthService(connection);
    const notifService = new NotificationService(connection);
    const midtransService = new MidtransService(connection);
    const userRequestService = new UserRequestService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("No user found!");
    const appConfigsService = new AppConfigService(connection);
    const appConfigs = await appConfigsService.getAllConfigs();
    const adminFee = appConfigs.filter(
      (config: any) => config.config_key === "withdraw_admin_fees"
    )[0];
    const availableAmount = user.coins;

    const isRequestAllowed =
      await userRequestService.validateAndStoreUserRequest(event, user.id);
    if (!isRequestAllowed) {
      return ResponseService.baseResponseJson(429, "Too many Request!", null);
    }

    if (!event.body) throw Error("Payload cannot be null!");

    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(UserWithdrawGopayIdRules).validate(
      parsedBody
    );
    if (!validate.status)
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });

    if (parsedBody.amount > availableAmount)
      return ResponseService.baseResponseJson(422, "Withdraw is failed", {
        error: true,
      });

    let userWithdrawStatus = UserWithdrawStatus.failed;

    const name = user.name || user.username;
    const fee =
      JSON.parse(`${adminFee.config_value}`).midtrans.fee +
      JSON.parse(`${adminFee.config_value}`).tagtag.fee;
    const realAmount = parsedBody.amount - fee;
    const currentDate = dayjs().format("DD MMMM YYYY");
    const currentTimestamp = dayjs().valueOf();

    const partnerReferenceNo = helperService
      .generateRandomNumber(10)
      .toString();
    const customerName = helperService.autoFixUsername(name);
    const value = realAmount.toFixed(2).toString();
    const currency = "IDR";
    const notes =
      "Withdraw " +
      customerName +
      " pada " +
      currentDate +
      " dengan nominal " +
      realAmount.toString();

    const basePath = "/production";
    let beneficiaryEmail = "";
    let gopayAccountId = "";
    if (event.path && event.path.startsWith(basePath)) {
      // beneficiaryEmail = user.email;
      beneficiaryEmail = "ibrahim@nominagames.com";
      gopayAccountId = user.gopay_id;
    } else {
      beneficiaryEmail = "ibrahim@nominagames.com";
      gopayAccountId = "01-86d1b28308d44a64a606f9f3cde3d97e-21";
    }

    const beneficiaryProvider = "gopay";
    const amount: CustomerTopupValueRequest = { value, currency };
    const additionalInfo: CustomerTopUpAdditionalInfoRequest = {
      beneficiaryEmail,
      beneficiaryProvider,
      gopayAccountId,
    };

    const withdrawData: MidtransCustomerTopupRequest = {
      partnerReferenceNo,
      customerName,
      amount,
      notes,
      additionalInfo,
    };

    // call midtrans access token
    const midtransMerchantOpenApiAccessToken =
      await midtransService.midtransMerchantOpenApiAccessToken(event.path);
    if (!midtransMerchantOpenApiAccessToken.success) {
      return ResponseService.baseResponseJson(
        422,
        "Midtrans Access Token is failed",
        { error: true }
      );
    }

    if (!midtransMerchantOpenApiAccessToken.data.accessToken) {
      return ResponseService.baseResponseJson(
        422,
        "Midtrans Access Token is not found",
        {}
      );
    }

    // call midtrans customer topup
    const midtransWithdrawResponse = await midtransService.customerTopup(
      withdrawData,
      midtransMerchantOpenApiAccessToken.data.accessToken,
      event.path
    );
    userWithdrawStatus = midtransWithdrawResponse.success
      ? UserWithdrawStatus.success
      : UserWithdrawStatus.failed;
    let notifCode = NOTIF_CODE.WITHDRAW_COIN_FAIL;
    const notificationParams: any = { nominal: parsedBody.amount - fee };

    if (userWithdrawStatus == UserWithdrawStatus.success) {
      notifCode = NOTIF_CODE.WITHDRAW_COIN_SUCCESS;
    } else {
      notifCode = NOTIF_CODE.WITHDRAW_COIN_FAIL;
    }
    await notifService.sendNotificationByCode(notifCode, notificationParams, [
      `${user.id}`,
    ]);

    if (!midtransWithdrawResponse.success) {
      return ResponseService.baseResponseJson(422, "Withdraw is failed", {
        error: true,
      });
    }

    const payouts = midtransWithdrawResponse.data;
    let status = UserWithdrawStatus.failed;
    if (payouts.responseCode == "2023800") {
      status = UserWithdrawStatus.success;
    } else {
      status = UserWithdrawStatus.failed;
    }
    const reference_no = payouts.referenceNo;

    console.log(status, reference_no);

    const midtransPayoutUserWithdraw = await userService.storeUserWithdraw({
      user_id: user.id,
      withdraw_amount: realAmount,
      status: midtransWithdrawResponse.success
        ? UserWithdrawStatus.success
        : UserWithdrawStatus.failed,
    });

    await midtransService.storeMidtransPayoutLogs({
      user_withdraw_id: midtransPayoutUserWithdraw.id,
      type: "emoneytopup",
      reference_no: reference_no,
      json_request: JSON.stringify(withdrawData),
      json_response: JSON.stringify(midtransWithdrawResponse.data),
    });

    const details: TransactionDetailRequest[] = [];
    if (midtransWithdrawResponse.success) {
      await userService.update(user, {
        coins: Number(user.coins) - parsedBody.amount,
      });

      const updatedUser = await userService.getUser(user);
      const prevValue = user.coins;
      const currValue = updatedUser?.coins || 0;

      details.push({
        type: "DB",
        currency: TransactionDetailCurrencyEnum.COIN,
        value: realAmount,
        previous_value: prevValue,
        current_value: currValue,
      });
    }

    await transactionService.storeUserTransaction(user, {
      description: TRANSACTION_DESCRIPTIONS.USER_WITHDRAW,
      code: TransactionAvailableCodeEnum.USER_WITHDRAW,
      extras: JSON.stringify({
        data: {
          user_withdraws: {
            status: midtransWithdrawResponse.success,
            amount: realAmount,
            currency: TransactionDetailCurrencyEnum.COIN,
          },
        },
      }),
      details: details,
    });

    return ResponseService.baseResponseJson(200, "Withdraw Succesfully", {
      id: midtransPayoutUserWithdraw.id,
      phone: parsedBody.phone,
      name: name,
      date: currentTimestamp,
      amout: parseInt(parsedBody.amount),
      fee: fee,
      total: realAmount,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const userWithdrawGopay: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await new Database().getConnection();
    const userService = new UserService(connection);
    const transactionService = new TransactionService(connection);
    const authService = new AuthService(connection);
    const notifService = new NotificationService(connection);
    const midtransService = new MidtransService(connection);
    const userRequestService = new UserRequestService(connection);
    const vipService = new VipService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("No user found!");
    const appConfigsService = new AppConfigService(connection);
    const appConfigs = await appConfigsService.getAllConfigs();
    const adminFee = appConfigs.filter(
      (config: any) => config.config_key === "withdraw_admin_fees"
    )[0];
    const availableAmount = user.coins;

    const isRequestAllowed =
      await userRequestService.validateAndStoreUserRequest(event, user.id);
    if (!isRequestAllowed) {
      return ResponseService.baseResponseJson(429, "Too many Request!", null);
    }

    if (!event.body) throw Error("Payload cannot be null!");

    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(UserWithdrawGopayRules).validate(
      parsedBody
    );
    if (!validate.status)
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });

    if (parsedBody.amount > availableAmount)
      return ResponseService.baseResponseJson(422, "Withdraw is failed", {
        error: true,
      });

    let userWithdrawStatus = UserWithdrawStatus.failed;

    const name = user.name || user.username;
    const fee =
      JSON.parse(`${adminFee.config_value}`).midtrans.fee +
      JSON.parse(`${adminFee.config_value}`).tagtag.fee;
    const realAmount = parsedBody.amount - fee;
    const currentDate = dayjs().format("DD MMMM YYYY");
    const currentTimestamp = dayjs().valueOf();

    const beneficiary_name = name;
    const beneficiary_account = parsedBody.phone.startsWith("0")
      ? parsedBody.phone
      : "0" + parsedBody.phone;
    const beneficiary_bank = "gopay";
    const beneficiary_email = user.email;
    const amount = realAmount.toString();
    const notes =
      "Withdraw " + name + " pada " + currentDate + " dengan nominal " + amount;

    const withdrawData: MidtransCreatePayoutRequest = {
      payouts: [
        {
          beneficiary_name,
          beneficiary_account,
          beneficiary_bank,
          beneficiary_email,
          amount,
          notes,
        },
      ],
    };

    const midtransWithdrawResponse = await midtransService.createPayout(
      withdrawData
    );
    userWithdrawStatus = midtransWithdrawResponse.success
      ? UserWithdrawStatus.success
      : UserWithdrawStatus.failed;
    let notifCode = NOTIF_CODE.WITHDRAW_COIN_FAIL;
    const notificationParams: any = { nominal: parsedBody.amount - fee };

    if (userWithdrawStatus == UserWithdrawStatus.success) {
      notifCode = NOTIF_CODE.WITHDRAW_COIN_SUCCESS;
    } else {
      notifCode = NOTIF_CODE.WITHDRAW_COIN_FAIL;
    }
    await notifService.sendNotificationByCode(notifCode, notificationParams, [
      `${user.id}`,
    ]);

    if (!midtransWithdrawResponse.success) {
      return ResponseService.baseResponseJson(422, "Withdraw is failed", {
        error: true,
      });
    }

    const payouts = midtransWithdrawResponse.data.payouts;
    const status = payouts[0].status;
    const reference_no = payouts[0].reference_no;
    const reference_nos: string[] = [reference_no];

    console.log(status, reference_no);

    const midtransApprovePayoutResponse = await midtransService.approvePayout({
      reference_nos: reference_nos,
    });

    if (!midtransApprovePayoutResponse.success) {
      return ResponseService.baseResponseJson(422, "Withdraw is failed", {
        error: true,
      });
    }

    const midtransPayoutUserWithdraw = await userService.storeUserWithdraw({
      user_id: user.id,
      withdraw_amount: realAmount,
      status: midtransApprovePayoutResponse.success
        ? UserWithdrawStatus.success
        : UserWithdrawStatus.failed,
    });

    await midtransService.storeMidtransPayoutLogs({
      user_withdraw_id: midtransPayoutUserWithdraw.id,
      type: "createpayout",
      reference_no: reference_no,
      json_request: JSON.stringify(withdrawData),
      json_response: JSON.stringify(midtransWithdrawResponse.data),
    });

    const details: TransactionDetailRequest[] = [];
    if (midtransApprovePayoutResponse.success) {
      const gopayNumber = parsedBody.phone.startsWith("0")
        ? parsedBody.phone
        : "0" + parsedBody.phone;
      await userService.update(user, {
        coins: Number(user.coins) - parsedBody.amount,
        gopay_number: gopayNumber,
      });

      await midtransService.storeMidtransPayoutLogs({
        user_withdraw_id: midtransPayoutUserWithdraw.id,
        type: "approvepayout",
        reference_no: reference_no,
        json_request: JSON.stringify({ reference_nos: reference_nos }),
        json_response: JSON.stringify(midtransApprovePayoutResponse.data),
      });

      const updatedUser = await userService.getUser(user);
      const prevValue = user.coins;
      const currValue = updatedUser?.coins || 0;

      details.push({
        type: "DB",
        currency: TransactionDetailCurrencyEnum.COIN,
        value: realAmount,
        previous_value: prevValue,
        current_value: currValue,
      });
    }

    await transactionService.storeUserTransaction(user, {
      description: TRANSACTION_DESCRIPTIONS.USER_WITHDRAW,
      code: TransactionAvailableCodeEnum.USER_WITHDRAW,
      extras: JSON.stringify({
        data: {
          user_withdraws: {
            status: midtransApprovePayoutResponse.success,
            amount: realAmount,
            currency: TransactionDetailCurrencyEnum.COIN,
          },
        },
      }),
      details: details,
    });

    // VIP USER
    await vipService.calculateWithdraw(user.id);

    return ResponseService.baseResponseJson(200, "Withdraw Succesfully", {
      id: midtransPayoutUserWithdraw.id,
      phone: parsedBody.phone,
      name: name,
      date: currentTimestamp,
      amout: parseInt(parsedBody.amount),
      fee: fee,
      total: realAmount,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const userAccountValidationGopay: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await new Database().getConnection();
    const authService = new AuthService(connection);
    const midtransService = new MidtransService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("No user found!");

    if (!event.body) throw Error("Payload cannot be null!");

    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(AccountValidationGopayRules).validate(
      parsedBody
    );
    if (!validate.status)
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });

    const phone = parsedBody.phone.startsWith("0")
      ? parsedBody.phone
      : "0" + parsedBody.phone;
    const account = phone;
    const bank = "gopay";

    const validation = await midtransService.accountValidation({
      account,
      bank,
    });

    if (!validation.success) {
      return ResponseService.baseResponseJson(422, "Phone number is Invalid", {
        error: true,
      });
    }

    return ResponseService.baseResponseJson(200, "Phone number is valid", {});
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const userSummaryHandler: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const handlers = {
      gopay: userSummaryGopay,
      gopay_id: userSummaryGopayId,
    } as any;
    const apiPath = event.pathParameters;

    if (apiPath && apiPath.type) {
      if (!["gopay", "gopay_id"].includes(apiPath.type))
        throw Error(
          "Invalid platfomr! It should be between `gopay` and `gopay_id`"
        );
      if (Object.keys(handlers).includes(apiPath.type)) {
        return await handlers[apiPath.type](event);
      }
    }
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const userSummaryGopayId: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await new Database().getConnection();
    const authService = new AuthService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    const appConfigsService = new AppConfigService(connection);
    const appConfigs = await appConfigsService.getAllConfigs();
    const adminFee = appConfigs.filter(
      (config: any) => config.config_key === "withdraw_admin_fees"
    )[0];
    if (!user) throw Error("No user found!");

    if (!event.body) throw Error("Payload cannot be null!");

    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(SummaryGopayIdRules).validate(
      parsedBody
    );
    if (!validate.status)
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });

    const name = user.name || user.username;
    const fee =
      JSON.parse(`${adminFee.config_value}`).midtrans.fee +
      JSON.parse(`${adminFee.config_value}`).tagtag.fee;
    const realAmount = parsedBody.amount - fee;
    const amount = parsedBody.amount;

    return ResponseService.baseResponseJson(200, "Gopay ID is valid", {
      name: name,
      fee: fee,
      amout: parseInt(amount),
      total: realAmount,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const userSummaryGopay: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await new Database().getConnection();
    const authService = new AuthService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    const appConfigsService = new AppConfigService(connection);
    const appConfigs = await appConfigsService.getAllConfigs();
    const adminFee = appConfigs.filter(
      (config: any) => config.config_key === "withdraw_admin_fees"
    )[0];
    if (!user) throw Error("No user found!");

    if (!event.body) throw Error("Payload cannot be null!");

    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(SummaryGopayRules).validate(
      parsedBody
    );
    if (!validate.status)
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });

    const name = user.name || user.username;
    const fee =
      JSON.parse(`${adminFee.config_value}`).midtrans.fee +
      JSON.parse(`${adminFee.config_value}`).tagtag.fee;
    const realAmount = parsedBody.amount - fee;
    const phone = parsedBody.phone.startsWith("0")
      ? parsedBody.phone
      : "0" + parsedBody.phone;
    const amount = parsedBody.amount;

    return ResponseService.baseResponseJson(200, "Phone number is valid", {
      phone: phone,
      name: name,
      fee: fee,
      amout: parseInt(amount),
      total: realAmount,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

const userWithdrawBank: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await database.getConnection();
    const userService = new UserService(connection);
    const authService = new AuthService(connection);

    const body = event.body;
    if (!body) throw Error("Body Request cannot be null!");

    const parsedBody = JSON.parse(body);

    const validate = await new Validator(UserWithdrawRules).validate(
      parsedBody
    );

    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    // check pin
    const checkPin = await authService.checkIsPinAuthenticated(
      user,
      parsedBody.pin
    );
    if (!checkPin.is_valid) {
      return ResponseService.baseResponseJson(422, "PIN is Invalid", {
        error: true,
      });
    }

    if (!checkPin.userPin) {
      return ResponseService.baseResponseJson(422, "User doesn't have pin", {
        error: true,
      });
    }

    if (!user.user_verification_id) {
      return ResponseService.baseResponseJson(
        422,
        "User is not verified!",
        null
      );
    }

    const verification = await userService.fetchUserVerificationById(
      user.user_verification_id
    );
    if (verification?.status !== UserVerificationStatusEnum.VERIFIED) {
      return ResponseService.baseResponseJson(
        422,
        "User is not verified!",
        null
      );
    }

    const successWithdraw = await userService.substractUserWithdrawAmount(
      user,
      parsedBody
    );
    return ResponseService.baseResponseJson(
      successWithdraw ? 200 : 422,
      successWithdraw ? "Withdraw Succesfully" : "Withdraw is failed",
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

const userWithdrawEWallet: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await database.getConnection();
    const userService = new UserService(connection);
    const authService = new AuthService(connection);

    const body = event.body;
    if (!body) throw Error("Body Request cannot be null!");

    const parsedBody = JSON.parse(body);

    const validate = await new Validator(AuthWithdrawEWalletRules).validate(
      parsedBody
    );

    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    // check pin
    const checkPin = await authService.checkIsPinAuthenticated(
      user,
      parsedBody.pin
    );
    if (!checkPin.is_valid) {
      return ResponseService.baseResponseJson(422, "PIN is Invalid", {
        error: true,
      });
    }

    if (!checkPin.userPin) {
      return ResponseService.baseResponseJson(422, "User doesn't have pin", {
        error: true,
      });
    }

    const successWithdraw = await userService.userWithdrawToEWallet(
      user,
      parsedBody
    );
    return ResponseService.baseResponseJson(
      successWithdraw ? 200 : 422,
      successWithdraw ? "Withdraw Succesfully" : "Withdraw is failed",
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const getAffiliateStatus: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const helperService = new HelperService();
  return await helperService.withConnection(async (connection) => {
    const userService = new UserService(connection);
    const authService = new AuthService(connection);

    // Get Logged User
    let user = null;
    const rawToken = event.headers.Authorization;
    if (rawToken != undefined) {
      const token = authService.sanitizeRawToken(rawToken);

      user = await userService.getUserByApiToken(token);
    }

    if (user == null) {
      return ResponseService.baseResponseJson(401, "Token is invalid.", null);
    }
    // End Get Logged User

    const affiliateStatus = await userService.getAffiliateStatus(user);

    return ResponseService.baseResponseJson(
      200,
      "Data fetched successfully",
      affiliateStatus
    );
  });
};

export const getAuthTransactions: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const helperService = new HelperService();
  return await helperService.withConnection(async (connection) => {
    const userService = new UserService(connection);
    const authService = new AuthService(connection);

    // Get Logged User
    let user = null;
    let code = undefined;
    const rawToken = event.headers.Authorization;
    if (rawToken) {
      const token = authService.sanitizeRawToken(`${rawToken}`);
      user = await userService.getUserByApiToken(token);
    }

    if (user == null)
      return ResponseService.baseResponseJson(401, "Token is invalid.", null);

    if (event.queryStringParameters) {
      const validate = await new Validator(AuthTransactionParamsRules).validate(
        event.queryStringParameters
      );
      if (!validate.status) {
        return ResponseService.baseResponseJson(422, "Payload is incorrect", {
          messages: validate.message,
        });
      }
      code = event.queryStringParameters.code as TransactionAvailableCodeEnum;
    }

    const transaction = await userService.getAuthTransactions(user, code);

    return ResponseService.baseResponseJson(
      200,
      "Data fetched successfully",
      transaction
    );
  });
};

export const getAuthMyTeam: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const helperService = new HelperService();
  return await helperService.withConnection(async (connection) => {
    const userService = new UserService(connection);
    const authService = new AuthService(connection);

    // Get Logged User
    let user = null;
    const rawToken = event.headers.Authorization;
    if (rawToken != undefined) {
      const token = authService.sanitizeRawToken(rawToken);

      user = await userService.getUserByApiToken(token);
    }

    if (user == null) {
      return ResponseService.baseResponseJson(401, "Token is invalid.", null);
    }
    // End Get Logged User

    const myTeam = await userService.getAuthMyTeam(user);

    return ResponseService.baseResponseJson(
      200,
      "Data fetched successfully",
      myTeam
    );
  });
};

export const logout: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse | AllResponse> => {
  const connection = await database.getConnection();
  const userService = new UserService(connection);
  const authService = new AuthService(connection);
  const userActivityService = new UserActivityService(connection);
  const pusherService = new PusherService();

  const rawToken = event.headers.Authorization;
  if (rawToken == undefined || rawToken == "") {
    return authService.generatePolicy(
      "" + rawToken,
      "Deny",
      event.requestContext.authorizer?.principalId
    );
  }

  const token = authService.sanitizeRawToken(rawToken);

  const user = await userService.getUserByApiToken(token);

  if (user != null) {
    await authService.logout(user);
    try {
      await pusherService.publish(
        `user-event`,
        `${EVENT_NAME.activity}:${user.id}`,
        {
          data: {
            user: {
              id: user.id,
              username: user.username,
            },
            status: FriendActivityStatusEnum.offline,
          },
        }
      );
      await userActivityService.updateUserActivityConnection(
        Number(user.id),
        FriendActivityStatusEnum.offline
      );
    } catch (error) {
      console.log("error", error);
    }
    await userService.removeDeviceTokensByUserId(user.id);
  }

  return ResponseService.baseResponseJson(200, "Logout successfully", null);
};

export const forgotPasswordPage = (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
) => {
  const query = event.queryStringParameters;
  const content = `<script>window.location.replace("tagtag://tagtag/deeplink?page=${query?.page}&t=${query?.t}&reset_password_token=${query?.reset_password_token}")</script>`;
  let response = {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html",
    },
    body: content,
  };

  if (!query?.page || !query?.t) {
    response = {
      statusCode: 404,
      headers: {
        "Content-Type": "text/html",
      },
      body: "Not Found!",
    };
  }

  // callback will send HTML back
  callback(null, response);
};
export const forgotPasswordConfirm: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await database.getConnection();
    const authService = new AuthService(connection);

    if (!event.body) throw Error("Payload must be filled!");

    const parsedBody: ForgotPasswordChangeRequest = JSON.parse(event.body);
    const validate = await new Validator(ForgotPasswordConfirmRules).validate(
      parsedBody
    );
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });
    }

    await authService.resetForgotPassword(parsedBody);
    return ResponseService.baseResponseJson(
      200,
      `Password updated successfully`,
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const getAuthCommissions: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  const helperService = new HelperService();
  return await helperService.withConnection(async (connection) => {
    try {
      const authService = new AuthService(connection);
      const revenueService = new RevenueService(connection);
      const rawToken = event.headers.Authorization;
      const user = await authService.getUserFromToken(`${rawToken}`);
      let year: number | undefined;

      if (!user) throw Error("User is not found!");
      if (event.queryStringParameters) {
        const validate = await new Validator(AuthCommissionQuery).validate(
          event.queryStringParameters
        );
        if (!validate.status) {
          return ResponseService.baseResponseJson(422, "Payload is incorrect", {
            messages: validate.message,
          });
        }
        year = Number(event.queryStringParameters.year);
      }

      const data = await revenueService.getUserYearlyCommission(user, year);
      return ResponseService.baseResponseJson(
        200,
        "Data fetched successfully",
        data
      );
    } catch (error: any) {
      return ResponseService.baseResponseJson(422, "Something Error", {
        error: error?.message ? error.message : JSON.stringify(error),
      });
    }
  });
};

export const storeAuthUserBank: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const connection = await new Database().getConnection();
    const authService = new AuthService(connection);
    const bankService = new BankService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("No user found!");

    let parsedBody: CreateUserBankRequest;
    if (!event.body) throw Error("Payload cannot be null!");

    parsedBody = JSON.parse(event.body);
    const validate = await new Validator(CreateUserBankRules).validate(
      parsedBody
    );
    if (!validate.status)
      return ResponseService.baseResponseJson(422, "Payload is incorrect", {
        messages: validate.message,
      });

    const success = await bankService.storeUserBankAccount(user, parsedBody);
    return ResponseService.baseResponseJson(200, "Data stored successfully", {
      success,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const getAuthUserBank: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  const helperService = new HelperService();
  return await helperService.withConnection(async (connection) => {
    try {
      const authService = new AuthService(connection);
      const bankService = new BankService(connection);
      const user = await authService.getUserFromToken(
        `${event.headers.Authorization}`
      );
      if (!user) throw Error("No user found!");

      const data = await bankService.mapUserBankData(user);
      return ResponseService.baseResponseJson(
        200,
        "Data fetched successfully",
        data
      );
    } catch (error: any) {
      return ResponseService.baseResponseJson(422, "Something Error", {
        error: error?.message ? error.message : JSON.stringify(error),
      });
    }
  });
};

export const getAuthPrize: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  const helperService = new HelperService();
  return await helperService.withConnection(async (connection) => {
    try {
      const authService = new AuthService(connection);
      const userService = new UserService(connection);
      const user = await authService.getUserFromToken(
        `${event.headers.Authorization}`
      );
      if (!user) throw Error("No user found!");

      const data = await userService.fetchUserExtPrizes(user);
      return ResponseService.baseResponseJson(
        200,
        "Data fetched successfully",
        data
      );
    } catch (error: any) {
      return ResponseService.baseResponseJson(422, "Something Error", {
        error: error?.message ? error.message : JSON.stringify(error),
      });
    }
  });
};

export const authPrizeClaim: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  try {
    const connection = await database.getConnection();
    const userService = new UserService(connection);
    const authService = new AuthService(connection);
    const telegramService = new TelegramService();

    const body = event.body;
    if (!body) throw Error("Body Request cannot be null!");

    const parsedBody = JSON.parse(body);

    const validate = await new Validator(UserClaimRules).validate(parsedBody);

    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    const userExtPrizeId = event.pathParameters?.userExtPrizeId;
    if (!userExtPrizeId || isNaN(Number(userExtPrizeId)))
      return ResponseService.baseResponseJson(
        422,
        "Please insert valid userExtPrizeId",
        {}
      );

    const UserClaimPrize = await userService.authPrizeClaim(
      user,
      parsedBody,
      Number(userExtPrizeId)
    );
    return ResponseService.baseResponseJson(
      200,
      UserClaimPrize ? "Claim Succesfully" : "Claim is failed",
      {}
    );
  } catch (error: any) {
    console.log(error);
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authStoreVerification: lambda.Handler = async (
  event: lambda.APIGatewayEvent
): Promise<BaseResponse> => {
  try {
    const body = event.body;
    if (!body) throw Error("Body Request cannot be null!");

    const parsedBody = JSON.parse(body);
    const validate = await new Validator(StoreVerificationRules).validate(
      parsedBody
    );

    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const connection = await database.getConnection();
    const userService = new UserService(connection);
    const authService = new AuthService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    const verification = await userService.storeUserVerifications(
      user,
      parsedBody
    );

    if (!verification) {
      return ResponseService.baseResponseJson(
        422,
        "User verification request is Failed!",
        {}
      );
    }

    return ResponseService.baseResponseJson(
      200,
      "User verification requested successfully!",
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authAddPin: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const handlers = {
      "resend-code": authAddPinResendCode,
      verify: authAddPinVerify,
    } as any;
    const apiPath = event.pathParameters;

    if (apiPath && apiPath.action) {
      if (!["verify", "resend-code", "new"].includes(apiPath.action))
        throw Error(
          "Invalid action it should be between `new`, `verify`, and `resend-code`"
        );
      if (Object.keys(handlers).includes(apiPath.action)) {
        return await handlers[apiPath.action](event);
      }
    }

    if (!event.body) throw Error("Body Request cannot be null!");
    const parsedBody = JSON.parse(event.body) as AuthChangePinRequest;
    const validate = await new Validator(AuthAddPinRules).validate(parsedBody);
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const emailService = new EmailService();
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    const newPinToken = await authService.setPinToUser(user, parsedBody);
    await emailService.sendTokenForVerifyPin(user, newPinToken);
    return ResponseService.baseResponseJson(
      200,
      "New user pin is set, please check your email to confirm it!",
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authAddPinVerify: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    if (!event.body) throw Error("Body Request cannot be null!");
    const parsedBody = JSON.parse(event.body) as VerifyAddPinRequest;
    const validate = await new Validator(VerifyAddPinRules).validate(
      parsedBody
    );
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    await authService.verifyAuthAddPin(user, parsedBody.request_pin_token);
    return ResponseService.baseResponseJson(200, "New pin is verified!", {});
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authAddPinResendCode: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const emailService = new EmailService();
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    const token = await authService.updateAuthRequestToken(user);
    await emailService.sendTokenForVerifyPin(user, token);
    return ResponseService.baseResponseJson(
      200,
      "Resend OTP Code is success!",
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authRequestForgotPin: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const handlers = {
      verify: authVerifyForgotPin,
    } as any;
    const apiPath = event.pathParameters;

    if (apiPath && apiPath.action) {
      if (!["request", "verify"].includes(apiPath.action))
        throw Error(
          "Invalid action it should be between `request` and `verify`"
        );
      if (Object.keys(handlers).includes(apiPath.action)) {
        return await handlers[apiPath.action](event);
      }
    }
    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const emailService = new EmailService();
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    const token = await authService.authForgotTokenRequest(user);
    await emailService.sendResetPIN(user, token);
    return ResponseService.baseResponseJson(
      200,
      "Link to reset PIN has been sent to user's email!",
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authVerifyForgotPin: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    if (!event.body) throw Error("Body Request cannot be null!");
    const parsedBody = JSON.parse(event.body) as AuthForgotPinRequest;
    const validate = await new Validator(ForgotPinRules).validate(parsedBody);
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    const token = await authService.verifyForgotPinRequest(user, parsedBody);
    return ResponseService.baseResponseJson(
      200,
      "Pin is resetted successfully!",
      {}
    );
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authChangePin: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    const handlers = {
      check: authCheckPin,
    } as any;
    const apiPath = event.pathParameters;

    if (apiPath && apiPath.action) {
      if (!["check", "change"].includes(apiPath.action))
        throw Error("Invalid action it should be between `check` and `change`");
      if (Object.keys(handlers).includes(apiPath.action)) {
        return await handlers[apiPath.action](event);
      }
    }

    if (!event.body) throw Error("Body Request cannot be null!");
    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(ChangePinRules).validate(parsedBody);
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    const checkPin = await authService.checkIsPinAuthenticated(
      user,
      parsedBody.old_pin
    );
    if (!checkPin.is_valid) {
      return ResponseService.baseResponseJson(422, "OLD PIN is invalid", {
        error: true,
      });
    }

    if (!checkPin.userPin) {
      return ResponseService.baseResponseJson(422, "User doesn't have pin", {
        error: true,
      });
    }

    await authService.changeAuthPin(checkPin.userPin, parsedBody.new_pin);
    return ResponseService.baseResponseJson(200, "PIN is updated", {
      success: true,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authChangeUsername: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    if (!event.body) throw Error("Body Request cannot be null!");
    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(CheckUsernameRules).validate(
      parsedBody
    );
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const userService = new UserService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");

    if (parsedBody.username.length > MAX_USERNAME_CHAR) {
      return ResponseService.baseResponseJson(
        422,
        "Username cannot exceed 16 characters in length",
        null
      );
    }

    if (
      helperService.isDefaultUsername(parsedBody.username) ||
      !helperService.isAlphanumeric(parsedBody.username)
    ) {
      return ResponseService.baseResponseJson(
        422,
        "Username is not allowed",
        null
      );
    }

    const usernameExists = await userService.checkUsernameExists(
      parsedBody.username
    );
    if (usernameExists)
      return ResponseService.baseResponseJson(422, "Username is exists", null);

    await authService.changeUsername(user, parsedBody.username);
    return ResponseService.baseResponseJson(200, "Username is updated", {
      success: true,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const authCheckPin: lambda.Handler = async (
  event: lambda.APIGatewayEvent
) => {
  try {
    if (!event.body) throw Error("Body Request cannot be null!");
    const parsedBody = JSON.parse(event.body);
    const validate = await new Validator(CheckPinRules).validate(parsedBody);
    if (!validate.status) {
      return ResponseService.baseResponseJson(422, validate.message, null);
    }

    const connection = await database.getConnection();
    const authService = new AuthService(connection);
    const user = await authService.getUserFromToken(
      `${event.headers.Authorization}`
    );
    if (!user) throw Error("User is not found!");
    const checkPin = await authService.checkIsPinAuthenticated(
      user,
      parsedBody.pin
    );

    if (!checkPin.is_valid) {
      return ResponseService.baseResponseJson(422, "PIN is invalid", {
        success: checkPin.is_valid,
      });
    }
    return ResponseService.baseResponseJson(200, "PIN is valid", {
      success: checkPin.is_valid,
    });
  } catch (error: any) {
    return ResponseService.baseResponseJson(422, "Something Error", {
      error: error?.message ? error.message : JSON.stringify(error),
    });
  }
};

export const loginWithTelegram: lambda.Handler = async (
  event: lambda.APIGatewayEvent,
  context: lambda.Context,
  callback: lambda.Callback
): Promise<BaseResponse> => {
  const connection = await database.getConnection();
  const authService = new AuthService(connection);
  const userService = new UserService(connection);
  const questService = new QuestService(connection);
  const missionService = new MissionService(connection);
  const vipService = new VipService(connection);

  const body = event.body;
  if (body == null) {
    return ResponseService.baseResponseJson(
      422,
      "Payload must be filled",
      null
    );
  }

  let parsedBody: LoginWithTelegramRequest;
  try {
    parsedBody = JSON.parse(body);
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(
      422,
      "Payload is incorrect. Please check logs",
      null
    );
  }

  // Validate Payload
  const validator = new Validator(LoginWithTelegramRules);

  const validate = await validator.validate(parsedBody);
  if (validate.status == false) {
    return ResponseService.baseResponseJson(422, validate.message, null);
  }

  // Check if user exists, if not create one
  let user: Users | null;

  try {
    const { hash, ...data } = authService.getTelegramData(
      parsedBody.tgWebAppData
    );

    if (!authService.validateTelegramHash(hash, data)) {
      return ResponseService.baseResponseJson(403, "Invalid hash", null);
    }

    const userData = JSON.parse(data.user);

    user = await authService.getUserByTelegramId(userData.id);
    let isFirstLogin = false;

    if (!user) {
      isFirstLogin = true;
      const createUserData: CreateUser = {
        telegram_id: `${userData.id}`,
        username: userData.username,
        name: `${userData.first_name} ${userData.last_name || ""}`.trim(),
      };

      const newUser = await userService.createUser(createUserData);
      if (!newUser) {
        return ResponseService.baseResponseJson(
          500,
          "Failed to create user",
          null
        );
      }
      user = newUser;

      await questService.insertUserQuestPreset({
        user_id: user.id,
        preset_id: user.vip ? QUEST_PRESET_VIP_ID : QUEST_PRESET_REGULAR_ID,
      });
      await missionService.insertUserMissionPreset({
        user_id: user.id,
        preset_id: user.vip ? MISSION_PRESET_VIP_ID : MISSION_PRESET_REGULAR_ID,
      });
    }

    if (!user.api_token) {
      user.api_token = await authService.generateApiToken();
      await connection.getRepository(Users).save(user);
    }

    const responseData = await authService.returnTokenData(
      user.api_token,
      isFirstLogin
    );

    return ResponseService.baseResponseJson(
      200,
      "Login successful",
      responseData
    );
  } catch (error) {
    console.error(error);
    return ResponseService.baseResponseJson(500, "An error occurred", null);
  }
};

// exports.loginWithGoogleId           = new MiddlewareWrapper().init(loginWithGoogleId, [checkForceUpdateMiddleware(),checkXApiSecretMiddleware()]);
// exports.register                    = new MiddlewareWrapper().init(register, []);
// exports.authRegistartionHandler     = new MiddlewareWrapper().init(authRegistartionHandler, []);
// exports.loginWithUsernameAndPassword= new MiddlewareWrapper().init(loginWithUsernameAndPassword, []);
// exports.getAuth                     = new MiddlewareWrapper().init(getAuth, [checkBannedMiddleware()]);
// exports.forgotPasswordRequest       = new MiddlewareWrapper().init(forgotPasswordRequest, [checkBannedMiddleware()]);
// exports.getAuthTransactions         = new MiddlewareWrapper().init(getAuthTransactions, [checkBannedMiddleware()]);
// exports.addAuthAffiliate            = new MiddlewareWrapper().init(addAuthAffiliate, [checkBannedMiddleware()]);
// exports.userWithdrawHandler         = new MiddlewareWrapper().init(userWithdrawHandler, [checkBannedMiddleware()]);
exports.userWithdrawBank = new MiddlewareWrapper().init(userWithdrawBank, [
  checkBannedMiddleware(),
]);
exports.userWithdrawEWallet = new MiddlewareWrapper().init(
  userWithdrawEWallet,
  [checkBannedMiddleware()]
);
// exports.getAffiliateStatus          = new MiddlewareWrapper().init(getAffiliateStatus, [checkBannedMiddleware()]);
// exports.getAuthCommissions          = new MiddlewareWrapper().init(getAuthCommissions, [checkBannedMiddleware()]);
// exports.getAuthUserBank             = new MiddlewareWrapper().init(getAuthUserBank, [checkBannedMiddleware()]);
// exports.storeAuthUserBank           = new MiddlewareWrapper().init(storeAuthUserBank, [checkBannedMiddleware()]);
// exports.getAuthPrize                = new MiddlewareWrapper().init(getAuthPrize, [checkBannedMiddleware()]);
// exports.authPrizeClaim              = new MiddlewareWrapper().init(authPrizeClaim, [checkBannedMiddleware()]);
// exports.authStoreVerification       = new MiddlewareWrapper().init(authStoreVerification, [checkBannedMiddleware()]);
// exports.authAddPin                  = new MiddlewareWrapper().init(authAddPin, [checkBannedMiddleware()]);
// exports.authRequestForgotPin        = new MiddlewareWrapper().init(authRequestForgotPin, [checkBannedMiddleware()]);
// exports.authChangePin               = new MiddlewareWrapper().init(authChangePin, [checkBannedMiddleware()]);
// exports.forgotPasswordConfirm       = new MiddlewareWrapper().init(forgotPasswordConfirm, [checkBannedMiddleware()]);
// exports.userAccountValidationGopay  = new MiddlewareWrapper().init(userAccountValidationGopay, [checkBannedMiddleware()]);
// exports.userSummaryGopay            = new MiddlewareWrapper().init(userSummaryGopay, [checkBannedMiddleware()]);
// exports.userWithdrawGopay           = new MiddlewareWrapper().init(userWithdrawGopay, [checkBannedMiddleware(),checkForceUpdateMiddleware(),checkXApiSecretMiddleware()]);
