import { Connection, DeleteResult, InsertResult, UpdateResult, Brackets, getManager, DeepPartial } from 'typeorm';
import { UploadResponse } from "../interfaces/responses/storage";
import { AwdPrepaidRequest, AwdCheckBillRequest, AwdPayBillRequest } from "../interfaces/requests/awd";
import { HelperService } from "./helper";
import { Users } from "../entities/users";
import dayjs from 'dayjs';
import sha256 from 'crypto-js/sha256';
import { AwdLogs } from '../entities/awd-logs';
import { TelegramService } from './telegram';
import { BankService } from './bank';
import { OperatorService } from './operator';
import { OperatorPurchases } from '../entities/operator-purchases';

export class AwdService {
    public dbConn           : Connection;
    public helperService    : HelperService;
    public telegramService  : TelegramService;
    public url              ?: string;
    public phoneNumber      ?: string;
    public userId           ?: string;
    public password         ?: string;

    constructor(Connection: Connection){
        this.dbConn = Connection;

        this.helperService   = new HelperService();
        this.telegramService = new TelegramService();
        this.url             = process.env.AWD_URL;
        this.phoneNumber     = process.env.AWD_PHONE_NUMBER;
        this.userId          = process.env.AWD_USER_ID;
        this.password        = process.env.AWD_PASSWORD;
    }

    private checkConfiguration() {
        if (
            !this.url || 
            !this.userId || 
            !this.password
        ) throw Error("AWD ENV is not configured");
    }

    private async generateSignature(time: string, msisdn: string): Promise <string | undefined> {
        if(msisdn.length < 4){
            return undefined;
        }

        const a = time + msisdn.slice(-4);
        const b = msisdn.slice(-4).split('').reverse().join('') + this.password;

        let xorResult = '';
        for (let i = 0; i < a.length; i++) {
            xorResult += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
        }

        const signature = Buffer.from(xorResult, 'binary').toString('base64');

        return signature;
    }

    public async callAPI(payload: object, endpoint: string): Promise <[success: boolean, message: string, data: object | undefined]>{
        this.checkConfiguration();

        const url = this.url;
        const header = [
            ["Content-Type",    "application/json"],
            ["Accept",          "application/json"]
        ];

        console.log(payload);
        try {
            const response = await this.helperService.post<any>(
                url + endpoint, 
                payload, 
                header
            );

            if (!response.parsedBody) {
                console.log(header);
                console.log(payload);
                console.log(response);
                return [false, "No responses from AWD", undefined];
            }

            const parsedBody = response.parsedBody;

            if (parsedBody.result == 0) {
                return [true, "API Processed", parsedBody];
            }
            console.log("AWD RESPONMSE", response, parsedBody);
            console.log("Call AWD API Failed. Something wrong with the API [1]");

            return [false, "Something wrong with the API [1]", parsedBody]; 
        } catch (error) {
            console.log(error);
            console.log("Call AWD API Failed. Something wrong with the API [2]");

            return [false, "Something wrong with the API [2]", undefined]; 
        }
    }

    /** prepaid is to topup vouchers operator like PLN */
    public async prepaid(input: AwdPrepaidRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        if(input.msisdn.length < 4){
            return {success: false, data: {}};
        }

        const timestamp = dayjs().format('HHmmss');
        const signature = await this.generateSignature(timestamp, input.msisdn);

        const payload = {
            "command"       : "TOPUP",
            "product"       : input.product_id,
            "userid"        : this.phoneNumber,
            "time"          : timestamp,
            "msisdn"        : input.msisdn,
            "partner_trxid" : this.helperService.generateTransactionCode(), // need to generate our internal transaction id TRXDDMMYY0001
            "signature"     : signature
        };

        const [success, message, data] = await this.callAPI(payload, '');
        // const [success, message, data] = [true, "API Processed", {"result":"0","msg":"PROSES, Isi pulsa sedang dalam proses. No trx: 21591825047 (Rp 10670). Saldo: Rp 453893. No HP: 085609993529.TURUN HARGA XL 15=14775.NAIK HARGA XL dan AXIS 25-50-100=24625-49250-98500","trxid":"21591825047","partner_trxid":"AWDTRX230626025531","sn":"","saldo":"453893","harga":"10670"}];

        /** SAMPLE RESPONSE */
        // Request:
        // { "command": "TOPUP", "product": "S10", "userid": "62811141631", "time": "181400",
        // "msisdn": "081296336000", "partner_trxid": "55555", "amount": "15645", "signature":
        // "AQgBAgECBQQFBg==" }
        // Response:
        // { "result": "0", "msg": "BERHASIL, Isi pulsa berhasil. No trx: 21000129136 (Rp 10100).
        // Saldo: Rp 495185. S/N 51003335092499 No HP: 081296336000.TURUN HARGA XL
        // 15=14775.NAIK HARGA XL dan AXIS 25-50-100=24625-49250-98500", "trxid":
        // "21000129136", "partner_trxid": "55555", "sn": "51003335092499", "saldo": "495185",
        // "harga": "10100" }

        return {success, data};
    }

    /** checkBill is to check the product bill for that particular user */
    public async checkBill(input: AwdCheckBillRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        if(input.msisdn.length < 4){
            return {success: false, data: {}};
        }

        const timestamp = dayjs().format('HHmmss');
        const signature = await this.generateSignature(timestamp, input.msisdn);

        const payload = {
            "command"       : "CEK",
            "product"       : input.product_id,
            "userid"        : this.phoneNumber,
            "time"          : timestamp,
            "msisdn"        : input.msisdn,
            "partner_trxid" : this.helperService.generateTransactionCode(), // need to generate our internal transaction id
            "signature"     : signature
        };

        const [success, message, data] = await this.callAPI(payload, '');

        /** SAMPLE REQUEST & RESPONSE */
        // Request:
        // { "command": "CEK", "product": "AETRA", "userid": "62811141631", "time": "181400",
        // "msisdn": "10054956", "partner_trxid": "55555", "amount": "243845", "signature":
        // "Bw0IAAECBw0AAA==" }
        // Response:
        // { "result": "0", "msg": "BERHASIL, Tagihan AETRA 10054956 J W IDING adalah sebesar
        // Rp.15645", "trxid": "0", "partner_trxid": "55555", "amount": "15645", "detail": { "id":
        // "10054956", "name": "J W IDING", "ori_amount": "13145", "admin_fee": "2500",
        // "total_amount": "15645" } }

        return {success, data};
    }

    /** checkBill is to check the product bill for that particular user */
    public async payBill(input: AwdPayBillRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        if(input.msisdn.length < 4){
            return {success: false, data: {}};
        }

        const timestamp = dayjs().format('HHmmss');
        const signature = await this.generateSignature(timestamp, input.msisdn);

        const payload = {
            "command"       : "PAY",
            "product"       : input.product_id,
            "userid"        : this.phoneNumber,
            "time"          : timestamp,
            "msisdn"        : input.msisdn,
            "partner_trxid" :  this.helperService.generateTransactionCode(), // need to generate our internal transaction id
            "amount"        : input.amount, // this one is from checkBill API
            "signature"     : signature
        };

        const [success, message, data] = await this.callAPI(payload, `${this.url}`);

        /** SAMPLE REQUEST & RESPONSE */
        // Request:
        // { "command": "PAY", "product": "AETRA", "userid": "62811141631", "time": "181400",
        // "msisdn": "10054956", "partner_trxid": "55555", "amount": "15645", "signature":
        // "Bw0IAAECBw0AAA==" }
        // Response:
        // { "result": "0", "msg": "BERHASIL: Pembayaran tagihan berhasil. No trx: 11000128414 (Rp
        // 14645). Saldo: Rp 505285.", "trxid": "11000128414", "partner_trxid": "55555", "amount":
        // "15645", "saldo": "505285", "harga": "14645" }

        return {success, data};
    }

    public async storeAwdLogs(schema: DeepPartial<AwdLogs>, user: Users): Promise<AwdLogs> {
        if (schema.json_response) {
            const response = JSON.parse(schema.json_response);

            if (response.result != 0 || response.result != 'success') {
                await this.telegramService.sendMessageAwdLog(user, schema);
            }
        }

        return await this.dbConn.getRepository(AwdLogs).save(schema);

    }
    /**
     * 
     * @param str sn from parsedBody
     * @returns PLN token
     */
    public fetchPLNTokenFromSN(str: string): string {
        const splitted = str.split("/");
        return (splitted.length > 0) ? splitted[0] : '';
    }

    public fetchPLNTokenFromSNCallback(str: string): string {
        const splitted = str.split("S/N ");
        return (splitted.length > 1) ? splitted[1].split('/')[0] : '';
    }

    public async getUsersAwdLogs(startDate: string, endDate: string) {
        const mappedUserDitkuLogs = [];
        const logs = await this.dbConn.getRepository(OperatorPurchases)
                    .createQueryBuilder('operatorPurchases')
                    .leftJoinAndSelect('operatorPurchases.user', 'user')
                    .leftJoinAndSelect('operatorPurchases.operator', 'operator')
                    .where('operatorPurchases.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
                    .getMany();
        
        for (const log of logs ) {
            mappedUserDitkuLogs.push({
                user_id         : log.user_id,
                username        : log.user.username,
                operator_id     : log.operator_id,
                operator_name   : log.operator.name,
                price           : log.operator.price,
                date            : log.created_at,
                number          : log.account_number,
                status          : log.status,
                created_at      : log.created_at
            })
        }

        return mappedUserDitkuLogs;

    }
}
