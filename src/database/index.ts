import {
  Connection,
  ConnectionManager,
  ConnectionOptions,
  createConnection,
  getConnectionManager,
  getConnection,
  Transaction,
  MixedList,
  EntitySchema,
  DataSource,
  DataSourceOptions,
} from "typeorm";
import { AffiliateBenefits } from "../entities/affiliate-benefits";
import { AffiliateSocials } from "../entities/affiliate-socials";
import { AffiliateUsers } from "../entities/affiliate-users";
import { Affiliates } from "../entities/affiliates";
import { AffiliateBenefitTierings } from "../entities/affiliate_benefit_tierings";
import { Banners } from "../entities/banners";
import { DailyLoginPrizes } from "../entities/daily-login-prizes";
import { DailyLoginUsers } from "../entities/daily-login-users";
import { DailyLogins } from "../entities/daily-logins";
import { GameInventories } from "../entities/game-inventories";
import { Games } from "../entities/games";
import { LuckyWheelPrizes } from "../entities/lucky-wheel-prizes";
import { LuckyWheelSessions } from "../entities/lucky-wheel-sessions";
import { LuckyWheels } from "../entities/lucky-wheels";
import { Missions } from "../entities/missions";
import { Quests } from "../entities/quests";
import { UserAddresess } from "../entities/user-addresess";
import { UserGameInventories } from "../entities/user-game-inventories";
import { UserMissions } from "../entities/user-missions";
import { UserQuests } from "../entities/user-quests";
import { UserReferralPrizes } from "../entities/user_referral_prizes";
import { Users } from "../entities/users";
import { Transactions } from "../entities/transactions";
import { LuckyWheelSessionPrizes } from "../entities/lucky-wheel-session-prizes";
import { AdsLogs } from "../entities/ads-logs";
import { UserGameScores } from "../entities/user-game-scores";
import { InAppPurchases } from "../entities/in-app-purchases";
import { InAppProducts } from "../entities/in-app-products";
import { InAppProductContents } from "../entities/in-app-product-contents";
import { ExtPrizes } from "../entities/ext-prizes";
import { RaffleTickets } from "../entities/raffle-tickets";
import { RafflePrizes } from "../entities/raffle-prizes";
import { Raffles } from "../entities/raffles";
import { UserExtPrizes } from "../entities/user-ext-prizes";
import { RevenueBaselines } from "../entities/revenue-baselines";
import { UserRevenues } from "../entities/user-revenues";
import { AffiliateUpgradeRequests } from "../entities/affiliate-upgrade-requests";
import { AffiliateUpgradeRequestSocials } from "../entities/affiliate-upgrade-request-socials";
import { PrizepoolDailyPercentages } from "../entities/prizepool-daily-percentages";
import { PrizepoolDistributions } from "../entities/prizepool-distributions";
import { PrizepoolIncrementLogs } from "../entities/prizepool-increment-logs";
import { Prizepools } from "../entities/prizepools";
import { Banks } from "../entities/banks";
import { UserBanks } from "../entities/user-banks";
import { UserWithdraws } from "../entities/user-withdraws";
import { DuitkuLogs } from "../entities/duitku-logs";
import { UserDevices } from "../entities/user-devices";
// import { Notifications } from '../entities/fcm-notifications';
import { AwdLogs } from "../entities/awd-logs";
import { Operators } from "../entities/operators";
import { UserVerifications } from "../entities/user-verifications";
import { TransactionDetails } from "../entities/transaction-details";
import { OperatorPurchases } from "../entities/operator-purchases";
import { AppConfigs } from "../entities/app-configs";
import { UserFriends } from "../entities/user-friends";
import { UserActivities } from "../entities/user-activities";
import { UserPins } from "../entities/user-pins";
import { FCMLogs } from "../entities/fcm-logs";
import { UserRequests } from "../entities/user-requests";
import { UserBans } from "../entities/user-bans";
import { Partners } from "../entities/partners";
import { PartnerAds } from "../entities/partner-ads";
import { RaffleParticipations } from "../entities/raffle-participations";
import { GameTutorials } from "../entities/game-tutorials";
import { MysteryBoxConfigs } from "../entities/mystery-box-configs";
import { MysteryBoxes } from "../entities/mystery-boxes";
import { FcmNotifications } from "../entities/fcm-notifications";
import { MidtransPayoutLogs } from "../entities/midtrans-payout-logs";
import { UserHackAttempts } from "../entities/user-hack-attempts";
import { QuestsPresets } from "../entities/quests-presets";
import { UserQuestsPresets } from "../entities/user-quests-presets";
import { UserMissionsPresets } from "../entities/user-missions-presets";
import { MissionsPresets } from "../entities/missions-presets";
import { VipMemberships } from "../entities/vip-membership";
import { VipPrizepools } from "../entities/vip-prizepools";
import { VipQuests } from "../entities/vip-quests";
import { UserVipQuests } from "../entities/user-vip-quests";
import { VipRewards } from "../entities/vip-rewards";
import { UserVipRewards } from "../entities/user-vip-rewards";
import { UserVipPointLogs } from "../entities/user-vip-point-logs";
import { UserRewardedAds } from "../entities/user-rewarded-ads";
import { RewardedAds } from "../entities/rewarded-ads";

/**
 * Database manager class
 */
export class Database {
  private connectionManager: ConnectionManager;
  // private dataSourceManager:
  private entities: MixedList<Function | string | EntitySchema>;
  private connectionConfig: ConnectionOptions | DataSourceOptions;
  constructor() {
    this.connectionManager = getConnectionManager();
    this.entities = [
      AdsLogs,
      AppConfigs,
      AffiliateBenefitTierings,
      AffiliateBenefits,
      AffiliateSocials,
      AffiliateUsers,
      Affiliates,
      Banks,
      Banners,
      DailyLoginPrizes,
      DailyLoginUsers,
      DailyLogins,
      DuitkuLogs,
      ExtPrizes,
      FCMLogs,
      GameInventories,
      Games,
      GameTutorials,
      InAppProductContents,
      InAppProducts,
      InAppPurchases,
      LuckyWheelPrizes,
      LuckyWheelSessions,
      LuckyWheelSessionPrizes,
      LuckyWheels,
      Missions,
      MysteryBoxConfigs,
      MysteryBoxes,
      FcmNotifications,
      Partners,
      PartnerAds,
      PrizepoolDailyPercentages,
      PrizepoolDistributions,
      PrizepoolIncrementLogs,
      Prizepools,
      RaffleParticipations,
      RafflePrizes,
      Raffles,
      RaffleTickets,
      RevenueBaselines,
      Quests,
      UserActivities,
      UserAddresess,
      UserBanks,
      UserBans,
      UserDevices,
      UserExtPrizes,
      UserFriends,
      UserGameScores,
      UserGameInventories,
      UserMissions,
      UserRequests,
      UserPins,
      UserQuests,
      UserReferralPrizes,
      UserRevenues,
      Users,
      UserVerifications,
      UserWithdraws,
      Transactions,
      TransactionDetails,
      AffiliateUpgradeRequests,
      AffiliateUpgradeRequestSocials,
      AwdLogs,
      Operators,
      OperatorPurchases,
      MidtransPayoutLogs,
      UserHackAttempts,
      QuestsPresets,
      UserQuestsPresets,
      UserMissionsPresets,
      MissionsPresets,
      VipMemberships,
      VipPrizepools,
      VipQuests,
      UserVipQuests,
      VipRewards,
      UserVipRewards,
      UserVipPointLogs,
      UserRewardedAds,
      RewardedAds,
    ];
    this.connectionConfig = {
      name: "default",
      type: "mysql",
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      synchronize: false,
      logging: false,
      timezone: "+00:00",
      host: process.env.DB_HOST,
      username: process.env.DB_USERNAME,
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD,
      extra: {
        charset: "utf8mb4_unicode_ci",
        waitForConnections: true,
        queueLimit: 0,
        connectionLimit: 50,
        acquireTimeout: 30000,
      },
      cache: true,
      entities: this.entities,
    };
  }

  public async injectOptions(
    connection: DataSource,
    connectionOptions: DataSourceOptions
  ): Promise<DataSource> {
    // @ts-ignore
    connection.options = connectionOptions;
    // @ts-ignore
    connection.manager = connection.createEntityManager();
    // @ts-ignore
    connection.buildMetadatas();

    return connection;
  }

  public async getDataSource(): Promise<DataSource> {
    const CONNECTION_NAME = "default";
    let ds: DataSource;
    const dsOptions: DataSourceOptions = this.connectionConfig;
    const datasource = new DataSource(dsOptions);
    if (datasource.isInitialized) {
      ds = await this.injectOptions(
        this.connectionManager.get(CONNECTION_NAME),
        dsOptions
      );
    } else {
      ds = await datasource.initialize();
    }
    return ds;
  }

  public async getConnection(): Promise<Connection> {
    try {
      const CONNECTION_NAME = "default";

      let connection: Connection;

      const connectionOptions: ConnectionOptions = this.connectionConfig;
      if (this.connectionManager.has(CONNECTION_NAME)) {
        connection = this.connectionManager.get(CONNECTION_NAME);

        if (!connection.isConnected) {
          console.log(
            "Existing connection found but not connected. Closing and recreating..."
          );
          await connection.close();
          connection = await createConnection(connectionOptions);
        } else {
          console.log("Reusing existing connection.");
        }
      } else {
        console.log("Creating new connection...");
        connection = await createConnection(connectionOptions);
      }

      console.log("DB connection name default is created");

      return connection;
    } catch (error) {
      console.log("ERROR WHEN GET CONNECTION", error);
      throw error;
    }
  }
}
