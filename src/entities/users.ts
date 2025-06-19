import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, OneToOne, ManyToMany, JoinTable } from "typeorm";
import { AffiliateUsers } from "./affiliate-users";
import { Affiliates } from "./affiliates";
import { DailyLoginUsers } from "./daily-login-users";
import { Transactions } from "./transactions";
import { UserAddresess } from "./user-addresess";
import { UserGameInventories } from "./user-game-inventories";
import { UserMissions } from "./user-missions";
import { UserQuests } from "./user-quests";
import { AdsLogs } from "./ads-logs";
import { LuckyWheelSessions } from "./lucky-wheel-sessions";
import { UserRevenues } from "./user-revenues";
import { RaffleTickets } from "./raffle-tickets";
import { UserBanks } from "./user-banks";
import { UserDevices } from "./user-devices";
import { UserVerifications } from "./user-verifications";
import { OperatorPurchases } from "./operator-purchases";
import { UserFriends } from "./user-friends";
import { UserActivities } from "./user-activities";
import { UserPins } from "./user-pins";
import { UserBans } from "./user-bans";
import { UserWithdraws } from "./user-withdraws";
import { RaffleParticipations } from "./raffle-participations";
import { InAppPurchases } from "./in-app-purchases";
import { UserVipQuests } from "./user-vip-quests";

export const UserFillable = [
    'username',
    'password',
    'name',
    'email',
    'phone_number',
    'google_id',
    'fb_id',
    'api_token',
    'otp_token',
    'avatar',
    'coupons',
    'activity_points',
    'coins',
    'activity_points',
    'is_confirmed',
    'confirm_otp_token',
    'change_email_otp_token',
    'temp_change_email',
    'reset_password_token',
    'lucky_wheel_spin_entries',
    'is_active',
    'referred_user_id',
    'withdrawable_amount',
    'free_ads_until',
    'free_ads_product_name',
    'gopay_id',
    'vip'
];

export const UserUpdateable = [
    'username',
    'password',
    'name',
    'email',
    'phone_number',
    'google_id',
    'fb_id',
    'api_token',
    'otp_token',
    'avatar',
    'coupons',
    'activity_points',
    'coins',
    'activity_points',
    'is_confirmed',
    'confirm_otp_token',
    'change_email_otp_token',
    'temp_change_email',
    'reset_password_token',
    'lucky_wheel_spin_entries',
    'is_active',
    'referred_user_id',
    'withdrawable_amount',
    'complete_quest_claimed',
    'can_claim_mystery_box',
    'free_ads_until',
    'free_ads_product_name',
    'gopay_id',
    'vip'
];

@Entity()
export class Users {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    username!: string;
   
    @Column()
    referred_user_id!: number;

    @Column()
    password!: string;
   
    @Column()
    name!: string;

    @Column()
    email!: string;
   
    @Column()
    phone_number!: string;

    @Column()
    google_id!: string;
    
    @Column()
    fb_id!: string;

    @Column()
    coins!: number;

    @Column()
    api_token!: string;
    
    @Column()
    otp_token!: string;
    
    @Column()
    avatar!: number;
    
    @Column()
    coupons!: number;
   
    @Column()
    activity_points!: number;
    
    @Column()
    is_confirmed!: boolean;

    @Column()
    confirm_otp_token!: string;

    @Column()
    change_email_otp_token!: string;
    
    @Column()
    temp_change_email!: string;
    
    @Column()
    reset_password_token!: string;

    @Column()
    lucky_wheel_spin_entries!: number;
    
    @Column()
    is_active!: boolean;
    
    @Column()
    user_verification_id!: number;
    
    @Column()
    user_pin_id?: number;

    @Column({ type: 'float' })
    withdrawable_amount!: number;

    @Column()
    complete_quest_claimed!: boolean;

    @Column()
    can_claim_mystery_box!: boolean;

    @Column()
    gopay_number!: string;

    @Column()
    stamina!: number;

    @Column("timestamp")
    free_ads_until?: string;

    @Column()
    free_ads_product_name!: string;

    @Column()
    gopay_id!: string;

    @Column()
    vip!: boolean;

    @Column()
    vip_points!: number;

    @Column("timestamp")
    created_at!: string;

    @Column("timestamp")
    updated_at?: string;

    @Column("timestamp")
    deleted_at?: string;
    
    // Relations
    @OneToMany(type => UserAddresess, userAddresess => userAddresess.user)
    userAddresess?: UserAddresess[];
    
    @OneToMany(type => UserQuests, userQuests => userQuests.user)
    userQuests?: UserQuests[];
   
    @OneToMany(type => UserMissions, userMissions => userMissions.user)
    userMissions?: UserMissions[];
    
    @OneToMany(type => UserGameInventories, userGameInventories => userGameInventories.user)
    userGameInventories?: UserGameInventories[];
   
    @OneToMany(type => DailyLoginUsers, dailyLoginUsers => dailyLoginUsers.user)
    dailyLoginUsers?: DailyLoginUsers[];
   
    @OneToOne(type => Affiliates, affiliates => affiliates.user)
    affiliate?: Affiliates;
   
    @OneToMany(type => AffiliateUsers, affiliateUsers => affiliateUsers.user)
    affiliateUsers!: AffiliateUsers[];
   
    @OneToMany(type => Transactions, transactions => transactions.user)
    transactions?: Transactions[];

    @OneToMany(type => AdsLogs, adsLogs => adsLogs.user)
    adsLogs?: AdsLogs[];

    @OneToMany(type => LuckyWheelSessions, session => session.user)
    luckyWheelSessions?: LuckyWheelSessions[];

    @OneToMany(type => UserRevenues, userRevenue => userRevenue.user)
    userRevenues!: UserRevenues[];
  
    @OneToMany(type => RaffleTickets, raffleTickets => raffleTickets.user)
    raffleTickets!: RaffleTickets[];

    @OneToMany(type => RaffleParticipations, raffleParticipations => raffleParticipations.user)
    participations!: RaffleParticipations[];

    @OneToMany(type => UserBanks, bank => bank.user)
    userBanks!: UserBanks[];

    @OneToMany(type => UserBans, banned => banned.user)
    bans!: UserBans[];

    @OneToMany(type => UserDevices, device => device.user)
    userDevices!: UserDevices[];

    @OneToMany(type => UserWithdraws, userWithdraw => userWithdraw.user)
    userWithdraws?: UserWithdraws[];


    @OneToOne(type => UserVerifications, verification => verification.user)
    @JoinColumn({
        name: 'user_verification_id'
    })
    verification?: UserVerifications

    @OneToOne(type => UserPins, user_pin => user_pin.user)
    @JoinColumn({
        name: 'user_pin_id'
    })
    userPin?: UserPins

    @OneToMany(type => OperatorPurchases, operatorPurchase => operatorPurchase.user)
    purchaseOperators!: OperatorPurchases[];

    @OneToMany(type => UserFriends, userFriend => userFriend.owner)
    userFriends!: UserFriends[];

    @OneToMany(type => UserFriends, userFriend => userFriend.friendDetail)
    friends!: UserFriends[];

    @OneToMany(type => UserActivities, userActivities => userActivities.user)
    activities!: UserActivities[];

    @OneToMany(type => InAppPurchases, inAppPurchases => inAppPurchases.user)
    inAppPurchases!: InAppPurchases[];

    @OneToMany(type => UserVipQuests, userVipQuests => userVipQuests.user)
    userVipQuests?: UserVipQuests[];
}