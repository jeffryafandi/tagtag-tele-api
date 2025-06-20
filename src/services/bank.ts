import { Users } from "../entities/users";
import { Banks } from "../entities/banks";
import { BaseService } from "./base";
import { CreateUserBankRequest } from "../interfaces/requests/users";
import { Connection } from "typeorm";
import { DuitkuService } from "./duitku";
import { DuitkuInquiryRequest } from "../interfaces/requests/duitku";
import { UserBanks } from "../entities/user-banks";
import { MIN_INQUIRY_AMOUNT } from "../config/constants";
import { CheckBankAccountRequest } from "../interfaces/requests/bank";
import { OperatorService } from "./operator";
import "dotenv/config";

export class BankService extends BaseService {
  public duitkuService: DuitkuService;
  protected operatorService: OperatorService;
  public duitkuCustomerId: string | undefined;
  constructor(conn: Connection) {
    super(conn);

    this.duitkuService = new DuitkuService(conn);
    this.operatorService = new OperatorService(this.dbConn);
    this.duitkuCustomerId = process.env.DUITKU_CUSTOMER_ID;
  }
  public async fetchBankList(): Promise<Banks[]> {
    return this.dbConn
      .getRepository(Banks)
      .createQueryBuilder()
      .where("is_active = 1")
      .orderBy("bank_code", "ASC")
      .getMany();
  }

  public async mapBankData() {
    return (await this.fetchBankList()).map((bank) => {
      return {
        id: bank.id,
        name: bank.name,
        bank_code: bank.bank_code,
        image_url: bank.image_url,
      };
    });
  }

  public async fetchBankById(id: number): Promise<Banks | null> {
    return await this.dbConn.getRepository(Banks).findOne({ where: { id } });
  }

  public async fetchUserBankByAccountNumber(
    bank: Banks,
    accountNumber: string,
    user: Users | null = null
  ): Promise<UserBanks | null> {
    let whereQuery: any = {
      bank_id: bank.id,
      account_number: accountNumber,
    };

    if (user) {
      whereQuery = { ...whereQuery, user_id: user.id };
    }

    return await this.dbConn
      .getRepository(UserBanks)
      .findOne({ where: whereQuery });
  }

  public async fetchUserBankById(id: number): Promise<UserBanks | null> {
    return await this.dbConn.getRepository(UserBanks).findOne({
      where: { id },
      join: {
        alias: "userBanks",
        leftJoinAndSelect: {
          bank: "userBanks.bank",
        },
      },
    });
  }

  public async fetchUserAllBank(user: Users): Promise<UserBanks[]> {
    return await this.dbConn
      .getRepository(UserBanks)
      .createQueryBuilder("userBanks")
      .where("user_id = :userId", { userId: user.id })
      .leftJoinAndSelect("userBanks.bank", "bank")
      .getMany();
  }

  public async mapUserBankData(user: Users) {
    const userBanks = await this.fetchUserAllBank(user);
    return userBanks.map((userBank) => {
      return {
        id: userBank.id,
        account_number: userBank.account_number,
        account_name: userBank.account_name,
        bank: {
          id: userBank.bank.id,
          name: userBank.bank.name,
          image_url: userBank.bank.image_url,
        },
      };
    });
  }

  public async checkBankAccountFromDuitku(
    payload: CheckBankAccountRequest
  ): Promise<any> {
    let bankCode = payload.bank_code;
    if (!bankCode && !payload.bank_id && !payload.operator_id)
      throw Error("bank_code or bank_ID is required!");

    if (payload.bank_id) {
      const bank = await this.fetchBankById(payload.bank_id);
      if (!bank) throw Error("Bank is not found!");
      const existed = await this.fetchUserBankByAccountNumber(
        bank,
        payload.account_number
      );

      if (existed) {
        return {
          account_name: existed.account_name,
          account_number: existed.account_number,
        };
      }
      bankCode = bank.bank_code;
    }
    if (payload.operator_id) {
      const operator = await this.operatorService.fetchOperatorById(
        payload.operator_id
      );
      if (!operator) throw Error("E Wallet not found!");
      bankCode = operator.code;
    }

    const inquiryRequest: DuitkuInquiryRequest = {
      amount: MIN_INQUIRY_AMOUNT,
      purpose: "Finding Account Detail",
      bank_account: payload.account_number,
      user_id: Number(this.duitkuCustomerId || 2),
      bank_code: `${bankCode}`,
      sender_name: "TagTag Admin",
    };

    const inquiryResponse = await this.duitkuService.inquiry(inquiryRequest);
    if (!inquiryResponse.success) {
      throw Error("Cannot fetch data from DuitkuAPI");
    }

    return {
      account_name: inquiryResponse.data.accountName,
      account_number: inquiryResponse.data.bankAccount,
    };
  }

  public async storeUserBankAccount(
    user: Users,
    payload: CreateUserBankRequest
  ): Promise<boolean> {
    const bank = await this.fetchBankById(payload.bank_id);
    if (!bank) throw Error("Bank is not found!");

    const existed = await this.fetchUserBankByAccountNumber(
      bank,
      payload.account_number,
      user
    );
    if (existed) throw Error("User Bank already registered!");

    const inquiryRequest: DuitkuInquiryRequest = {
      amount: MIN_INQUIRY_AMOUNT,
      purpose: "Finding Account Detail",
      user_id: user.id,
      bank_account: payload.account_number,
      bank_code: bank.bank_code,
      sender_name: "TagTag Admin",
    };

    // const inquiryResponse = await this.duitkuService.inquiry(inquiryRequest);
    const inquiryResponse: any = {};

    await this.dbConn.getRepository(UserBanks).save({
      user_id: user.id,
      bank_id: bank.id,
      account_name: inquiryResponse?.data?.accountName || payload.account_name,
      account_number:
        inquiryResponse?.data?.bankAccount || payload.account_number,
    });

    return true;
  }
}
