import { Connection, DeleteResult, InsertResult, UpdateResult, Brackets, getManager, DeepPartial } from 'typeorm';
import { UploadResponse } from "../interfaces/responses/storage";
import { DuitkuTransferRequest, DuitkuInquiryRequest, FilterUsersDuitkuLogs } from "../interfaces/requests/duitku";
import { HelperService } from "./helper";
import { Users } from "../entities/users";
import dayjs from 'dayjs';
import sha256 from 'crypto-js/sha256';
import { DuitkuPossibleTransferResponse, DuitkuResponseCodes } from '../interfaces/responses/duitku';
import { DuitkuLogs } from '../entities/duitku-logs';
import { BankService } from './bank';
import fs from 'fs';
import path from 'path';

export class DuitkuService {
    public dbConn           : Connection;
    public helperService    : HelperService;
    public url              ?: string;
    public userId           ?: string;
    public customerId       ?: string;
    public email            ?: string;
    public secretKey        ?: string;
    public inquiryEndpoint  ?: string;
    public transferEndpoint ?: string;

    /** DUITKU FLOW */
    // Inquiry -> Transfer
    // Ref: https://docs.duitku.com/disbursement/id/#alur-transaksi-transfer-online

    constructor(Connection: Connection){
        this.dbConn = Connection;

        this.helperService      = new HelperService();
        const config            = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config.json'), 'utf8'));
        this.url                = config.DUITKU_URL;
        this.userId             = config.DUITKU_USER_ID;
        this.customerId         = config.DUITKU_CUSTOMER_ID;
        this.email              = config.DUITKU_EMAIL;
        this.secretKey          = config.DUITKU_SECRET_KEY;
        this.inquiryEndpoint    = config.DUITKU_INQUIRY_ENDPOINT;
        this.transferEndpoint   = config.DUITKU_TRANSFER_ENDPOINT;
    }

    private checkConfiguration() {
        if (
            !this.url || 
            !this.customerId || 
            !this.secretKey ||
            !this.transferEndpoint ||
            !this.inquiryEndpoint ||
            !this.email ||
            !this.customerId ||
            !this.userId
        ) throw Error("DuitKu ENV is not configured");
    }

    private generateInquirySignature(time: number, input: DuitkuInquiryRequest) {
        return sha256(
            `${this.email}` + 
            time + 
            input.bank_code + 
            input.bank_account + 
            input.amount + 
            input.purpose + 
            this.secretKey
        ).toString();
    }
    private generateTransferSignature(time: number, input: DuitkuTransferRequest) {
        return sha256(
            `${this.email}` + 
            time + 
            input.bank_code + 
            input.bank_account + 
            input.account_name +
            input.cust_ref_number + 
            input.amount + 
            input.purpose + 
            input.disburse_id +
            this.secretKey
        ).toString()
    }

    public async callAPI(payload: object, endpoint: string): Promise <[success: boolean, message: string, data: DuitkuPossibleTransferResponse | undefined]>{
        this.checkConfiguration();
        let url = this.url;
        let header = [
            ["Content-Type",    "application/json"],
            ["Accept",          "application/json"]
        ];

        console.log(payload);
        try {
            const response = await this.helperService.post<DuitkuPossibleTransferResponse>(
                url + endpoint, 
                payload, 
                header
            );

            if (!response.parsedBody) {
                console.log(header);
                console.log(payload);
                console.log(response);
                return [false, "No responses from DuitKu", undefined];
            }

            const parsedBody = response.parsedBody;

            if (parsedBody.responseCode == DuitkuResponseCodes.success) {
                return [true, "API Processed", parsedBody];
            }
            console.log(response, parsedBody);
            console.log("Call DuitKu API Failed. Something wrong with the API [1]");

            return [false, "Something wrong with the API [1]", parsedBody]; 
        } catch (error) {
            console.log(error);
            console.log("Call DuitKu API Failed. Something wrong with the API [2]");

            return [false, "Something wrong with the API [2]", undefined]; 
        }
    }

    public async inquiry(input: DuitkuInquiryRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        const timestamp         = dayjs().valueOf();
        const roundedTimestamp  = Math.round(timestamp);
        const signature         = this.generateInquirySignature(roundedTimestamp, input)

        let payload = {
            "userId"            : this.userId,
            "amountTransfer"    : input.amount,
            "bankAccount"       : input.bank_account,
            "bankCode"          : input.bank_code,
            "email"             : this.email,
            "purpose"           : input.purpose,
            "timestamp"         : roundedTimestamp,
            "senderId"          : input.user_id,
            "senderName"        : input.sender_name,
            "signature"         : signature
        };

        const [success, message, data] = await this.callAPI(payload, `${this.inquiryEndpoint}`);

        return {success, data};
    }

    public async transfer(input: DuitkuTransferRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        const timestamp         = dayjs().valueOf();
        const roundedTimestamp  = Math.round(timestamp);
        const signature         = this.generateTransferSignature(roundedTimestamp, input);

        let payload = {
            "disburseId"        : input.disburse_id,
            "userId"            : this.userId,
            "amountTransfer"    : input.amount,
            "accountName"       : input.account_name,
            "custRefNumber"     : input.cust_ref_number,
            "bankAccount"       : input.bank_account,
            "bankCode"          : input.bank_code,
            "email"             : this.email,
            "purpose"           : input.purpose,
            "timestamp"         : roundedTimestamp,
            "signature"         : signature
        };
        const [success, message, data] = await this.callAPI(payload, `${this.transferEndpoint}`);

        return {success, data};
    }

    public async storeDuitkuLogs(schema: DeepPartial<DuitkuLogs>): Promise<DuitkuLogs> {
        return await this.dbConn.getRepository(DuitkuLogs).save(schema);
    }

    public async getUsersDuitkuLogs(startDate: string, endDate: string) {
        const bankService       = new BankService(this.dbConn);
        const bankList          = await bankService.fetchBankList();

        let mappedUserDitkuLogs = [];

        let logs = await this.dbConn.getRepository(DuitkuLogs)
                    .createQueryBuilder('duitkuLogs')
                    .leftJoinAndSelect('duitkuLogs.userWithdraw', 'userWithdraw')
                    .leftJoinAndSelect('userWithdraw.user', 'user')
                    .leftJoinAndSelect('user.userBanks', 'userBanks')
                    .leftJoinAndSelect('userBanks.bank', 'bank')
                    .where('duitkuLogs.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
                    .getMany();
        
        for (const log of logs ) {
            const response      = JSON.parse(log.json_response);
            const bankCode      = response.bankCode;
            const bankId        = bankList.filter((bank_id) => bank_id.bank_code == bankCode).map(b=>b.id).toString();
            const bankName      = bankList.filter((bank_name) => bank_name.bank_code == bankCode).map(b=>b.name).toString();
            const bankAccount   = response.bankAccount;
            

            mappedUserDitkuLogs.push({
                user_id     : log.userWithdraw.user_id,
                username    : log.userWithdraw.user.username,
                bank_id     : bankId,
                bank_name   : bankName,
                bank_account: bankAccount,
                amount      : log.userWithdraw.withdraw_amount,
                status      : log.userWithdraw.status,
                created_at  : log.created_at
            })
        }

        return mappedUserDitkuLogs;

    }
}