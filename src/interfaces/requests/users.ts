import { Users } from "../../entities/users";
import { Affiliates } from "../../entities/affiliates";
import { AffiliateUpgradeRequests } from "../../entities/affiliate-upgrade-requests";

enum SortByEnum {
  ASC = "ASC",
  DESC = "DESC",
}

export enum AvailableWithdrawCurrency {
  coin = "coin",
  revenue = "revenue",
}

export enum UserVerificationStatusEnum {
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

export interface CreateUser {
  username?: string;
  email?: string;
  phone_number?: string;
  password?: string;
  confirm_otp_token?: string;
  name?: string;
  telegram_id?: string;
}

export interface UpdateUser {
  add_coins: number;
  add_coupons: number;
  add_activity_point: number;
  coins?: number;
}

export interface CreateUserGoogleIdRequest {
  username: string;
  email: string;
  google_id: string;
  otp_token: string;
  password?: string;
  referrer_username?: string;
}

export interface UserWithdrawRequest {
  amount: number;
  user_bank_id: number;
  currency: AvailableWithdrawCurrency;
}

export interface UserWithdrawEWalletRequest {
  operator_id: number;
  account_number: string;
  currency: AvailableWithdrawCurrency;
}

export interface UserClaimPrize {
  msisdn: string;
}

export interface FilterUserAnalytic {
  start_date: string;
  end_date: string;
}

export interface FilterUser {
  id?: number;
  page?: number;
  search?: string;
  sort?: string;
  sortBy?: SortByEnum;
}

export interface CreatePrimaryAddress {
  address: string;
  notes: string;
  recipient_name: string;
  phone_number: string;
}

export interface AddAuthAffiliateRequest {
  user_id?: number;
  type?: string;
  name: string;
  description?: string;
  link?: string;
  pic?: string;
  phone_number?: string;
  email: string;
  affiliate_benefit_id: number;
  status?: AvailableAffiliateStatus;
}

export interface AddAffiliateSocials {
  affiliate: Affiliates;
  type: string;
  link: string;
}

export interface UpgradeAffiliateRequest {
  affiliate_id: Affiliates;
  type: string;
  name: string;
  description: string;
  phone_number: string;
  email: string;
}

export interface AffiliateUpgradeSocialsRequest {
  affiliateUpgradeRequests: AffiliateUpgradeRequests;
  type: string;
  link: string;
}

export interface AddUserReferralPrizeRequest {
  user: Users;
  referred_user_id: number;
}

export enum AvailableAffiliateStatus {
  pending = "pending",
  approved = "approved",
  none = "none",
  rejected = "rejected",
}

export enum RejectReason {
  duplicate = "duplicate",
  folls = "folls",
  incorrect = "incorrect",
}
export type UpdateStatusAffiliateRequest = {
  status: AvailableAffiliateStatus;
  reason: RejectReason;
  tier: string;
};

export type RejectStatusAffiliateRequest = {
  status: AvailableAffiliateStatus;
};

export type CreateUserBankRequest = {
  bank_id: number;
  account_number: string;
  account_name?: string;
};

export enum UserWithdrawStatus {
  success = "success",
  failed = "failed",
}

export enum UserClaimPrizeStatus {
  success = "success",
  failed = "failed",
}

export interface BanUnBanUsersRequest {
  user_ids: Array<number>;
  reason?: string;
  expired_in: number;
}

export interface CreateUserGopayIdRequest {
  auth_code: string;
}
