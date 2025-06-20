import { Users } from "../entities/users";
import { AwdLogs } from "../entities/awd-logs";
import { HelperService } from "./helper";
import { ITelegramSendMessageResponse } from "../interfaces/responses/telegram";
import { AffiliateUpgradeRequests } from "../entities/affiliate-upgrade-requests";
import { Affiliates } from "../entities/affiliates";
import { UserVerifications } from "../entities/user-verifications";
import "dotenv/config";

export class TelegramService {
  private helperService: HelperService;
  constructor() {
    this.helperService = new HelperService();
  }
  public async sendMessageTelegram(message: string, channelName: string) {
    const ApiToken = process.env.TELEGRAM_API_TOKEN;
    const baseUrl = process.env.TELEGRAM_BASE_URL;
    const text = encodeURIComponent(message);

    if (ApiToken === undefined || baseUrl === undefined) {
      console.log("Sending message failed. Missing some env variables.");
      return false;
    }

    const urlString = `${baseUrl}/bot${ApiToken}/sendMessage?chat_id=${channelName}&text=${text}`;
    const response = await this.helperService.get<ITelegramSendMessageResponse>(
      urlString
    );
    console.log("Finish Sending message to Telegram: ", response);
    return true;
  }

  public async sendMessageAwdLog(
    user: Users,
    awdLog: AwdLogs | any
  ): Promise<boolean> {
    const message =
      "\
👹 Error on AWD Transactions 🔥\n\n\
🏡 [DEV] \n\n\
User :  " +
      user.username +
      "\n\
Action : " +
      awdLog.logable_tab +
      ", ID: " +
      awdLog.logable_tab_id +
      "\n\
Type : " +
      [awdLog.type] +
      "\n\
Data : " +
      [awdLog.json_response] +
      "\n\
 ";
    const channelName = process.env.TELEGRAM_CHANNEL_NAME || "";

    await this.sendMessageTelegram(message, channelName);

    return true;
  }

  public async sendMessageAffiliateRequest(
    user: Users,
    currentLevel: Affiliates,
    affiliateRequest: AffiliateUpgradeRequests
  ): Promise<boolean> {
    try {
      const message =
        "\
✅ AFFILIATE UPGRADE REQUEST ✅\n\n\
User :  " +
        user.username +
        "\n\
UserID :  " +
        user.id +
        "\n\
Email : " +
        user.email +
        "\n\
Current Level : " +
        currentLevel.affiliateBenefit.name +
        "\n\
UpgradeRequestID : " +
        affiliateRequest.id +
        "\n\
";
      const channelName = process.env.TELEGRAM_CHANNEL_NAME || "";

      await this.sendMessageTelegram(message, channelName);

      return true;
    } catch (error) {
      throw error;
    }
  }

  public async sendPendingKYCInfo(
    user: Users,
    verification: UserVerifications
  ): Promise<boolean> {
    try {
      const message =
        "\
✅ NEW USER KYC REQUEST ✅\n\n\
User :  " +
        user.username +
        "\n\
UserID :  " +
        user.id +
        "\n\
Email : " +
        user.email +
        "\n\
verificationID : " +
        verification.id +
        "\n\
imageURL : " +
        verification.image_url +
        "\n\
";
      const channelName = process.env.TELEGRAM_CHANNEL_NAME || "";

      await this.sendMessageTelegram(message, channelName);

      return true;
    } catch (error) {
      throw error;
    }
  }
}
