import { Pagination } from '../interfaces/generals/pagination';
import { ROWS_PER_PAGE, EXPIRED_TIME_VERIFY_X_API_SECRET } from "../config/constants";
import { HttpResponse } from '../interfaces/generals/response';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import underscore from 'underscore';
import dayjs, { Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import NodeRSA from 'node-rsa';
import { readFileSync } from 'fs';
dayjs.extend(timezone);
import { Database } from '../database';
import { Connection, ConnectionManager, ConnectionOptions, createConnection, getConnectionManager, getConnection, Transaction, MixedList, EntitySchema, DataSource, DataSourceOptions } from 'typeorm';

export class HelperService {
    public months       : Array<string>
    public monthsBahasa : Array<string>

    constructor() {
        this.months         = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        this.monthsBahasa   = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    }
    public isMoreThan24Hours(date: string): boolean {
        const now       = Date.now();
        const then      = +date;
        const oneDay    = 24 * 60 * 60 * 1000;

        const isMoreThanADay = (now - then) > oneDay;
        return isMoreThanADay;
    }

    public isOneWeek(date: string): boolean {
        const now       = Date.now();
        const then      = +date;
        const oneDay    = 24 * 60 * 60 * 1000;
        const oneWeek   = oneDay * 7;

        const isOneWeek = (now - then) > oneWeek;
        return isOneWeek;
    }

    public isIterable(obj: any): boolean{
        if (obj == null) {
            return false;
        }
        return typeof obj[Symbol.iterator] === 'function';
    }

    public wrapObject(object: object | undefined, wrapper: any): object | undefined{
        if(object === undefined){
            return undefined;
        }

        return underscore.pick(object, wrapper);
    }

    public wrapObjects(objects: object | undefined, wrapper: any): object | undefined{
        if(objects === undefined){
            return undefined;
        }

        return underscore.toArray(underscore.mapObject(objects, function(val, key){
            return underscore.pick(val, wrapper);
        }));
    }

    public generatePagination(event: any, total: number): Pagination | undefined{
        const input = event.queryStringParameters;

        if(input == undefined || input.page == undefined){
            return undefined;
        }

        return {
            PageNo      : input.page,
            PageLength  : ROWS_PER_PAGE,
            Total       : total,
        };
    }

    public deg2rad(deg: number) {
        return deg * (Math.PI/180)
    }

    public joinArray(input: Array<number>) {
        let value = "''";
        if(input.length > 0){
            value = input.join();
        }

        return value;
    }

    public calculateDistance(lat1: number, lon1:number, lat2:number, lon2:number): number{
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2-lat1);  // deg2rad below
        const dLon = this.deg2rad(lon2-lon1); 
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2)
            ; 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; // Distance in km
        return d;
    }

    public getRandomInt(max: number): number {
        return Math.floor(Math.random() * max);
    }

    public generateRandomNumber(length: number = 5): number {
        let base        = '1';
        let maxNumber   = '9';

        for (let zero = 1; zero < length; zero++) {
            base = base + '0';
            maxNumber = maxNumber + '0'; 
        }

        return Math.floor(Number(base) + Math.random() * Number(maxNumber));
    }

    public generateOTPToken(length: number = 5){
        let otpToken = '';

        for (let index = 0; index < length; index++) {
            otpToken += String(this.getRandomInt(9));            
        }

        return otpToken;
    }

    public generateConfirmOtpToken(length: number = 5){
        let confirmOtpToken = '';

        for (let index = 0; index < length; index++) {
            confirmOtpToken += String(this.getRandomInt(9));            
        }

        return confirmOtpToken;
    }
    
    public slugify(str: string): string{
        str = str.replace(/^\s+|\s+$/g, ''); // trim
        str = str.toLowerCase();
    
        // remove accents, swap ñ for n, etc
        const from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
        const to   = "aaaaeeeeiiiioooouuuunc------";
        for (let i=0, l=from.length ; i<l ; i++) {
            str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
        }

        str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
            .replace(/\s+/g, '-') // collapse whitespace and replace by -
            .replace(/-+/g, '-'); // collapse dashes

        return str;
    };

    public async http<T>(path: string, args: any): Promise<HttpResponse<T>> {
        const response: any = await fetch(path, args);

        try {
            response.parsedBody = await response.json();
        } catch (ex) {}
      
        if (!response.ok) {
            console.log(response);
          throw new Error(response);
        }

        return response;
    }

    public async get<T>(
        path: string, 
        args: RequestInit = { method: "get" })
    : Promise<HttpResponse<T>> {
        return await this.http<T>(path, args);
    };

    public async getMidtrans<T>(
        path: string, 
        headers: any,
        args: RequestInit = { method: "get", headers: headers })
    : Promise<HttpResponse<T>> {
        return await this.http<T>(path, args);
    };

    public async post<T>(
        path    : string,
        body    : any,
        headers : any,
        args    : RequestInit = { method: "post", body: JSON.stringify(body), headers: headers }
    ): Promise<HttpResponse<T>>  {
        console.log("POST Request:");
        console.log("URL:", path);
        console.log("Headers:", headers);
        console.log("Body:", body);
        console.log("Args:", args);
        return await this.http<T>(path, args);
    };

    public async rawPost<T>(
        path    : string,
        body    : any,
        headers : any,
        args    : RequestInit = { method: "post", body: body, headers: headers }
    ): Promise<HttpResponse<T>>  {
        return await this.http<T>(path, args);
    };

    public async put<T>(
        path: string,
        body: any,
        args: RequestInit = { method: "put", body: JSON.stringify(body) }
    ): Promise<HttpResponse<T>>  {
        return await this.http<T>(path, args);
    };

    public generateUUIDCode(): string {
        return uuidv4();
    }

    public getMonthStrig(date: Date) {
        const months = this.months;
        return months[date.getMonth()];
    }

    public getMonthIndex(monthName: string) {
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        return months.findIndex((month) => month == monthName);
    }

    public translateMonthToBahasa(monthName: string) {
        const index = this.getMonthIndex(monthName);
        return this.monthsBahasa[index];
    }

    public getDaysDifferences(endDate: Date, startDate: Date) {
        const difference = endDate.getTime() - startDate.getTime();
        return Math.ceil(difference / (1000 * 3600 * 24));
    }

    public toDateTime(date: Dayjs) {
        return date.format('YYYY-MM-DD HH:mm:ss');
    }

    public substractHours(stringDate: string, hours: number) {
        return dayjs(stringDate).subtract(hours, 'hour').format('YYYY-MM-DD HH:mm:ss');
    }

    public substractDays(stringDate: string, days: number) {
        return dayjs(stringDate).subtract(days, 'days').format('YYYY-MM-DD HH:mm:ss');
    }

    public addHours(stringDate: string, hours: number) {
        return dayjs(stringDate).add(hours, 'hour').format('YYYY-MM-DD HH:mm:ss');
    }

    public addDays(stringDate: any, days: number) {
        return dayjs(stringDate).add(days, 'days').format('YYYY-MM-DDTHH:mm:ss')
    }

    public xorBinaryStrings(a: string, b: string): string {
        let result = "";
        for(let i = 0; i < a.length; i++){
            result += (parseInt(a[i]) ^ parseInt(b[i])).toString();
        }

        return result;
    }

    public toFixNumber(initialNumber: number) {
        const stringified = initialNumber.toFixed(3);
        return Number(stringified);
    }

    public generateTransactionCode(): string {
        const now = dayjs().subtract(7, 'hours').format('YYMMDDHHmmss');
        return `AWDTRX${now}`;
    }

    /**
     * 
     * @param str string you want to find and replace
     * @param mapObj obj of mapping {"found_word": "replace with"}
     * @returns string
     */
    public replaceAll(str: string, mapObj: Record<string, string>): string {
        const re = new RegExp(Object.keys(mapObj).join("|"),"gi");
        console.log("RE", re);
        return str.replace(re, function(matched){
            return mapObj[matched.toLowerCase()];
        });
    }
    public ucFirst(str: string): string {
        const arr = str.split(" ");
        for (let i = 0; i < arr.length; i++) {
            arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
        
        }
        return arr.join(" ");
    }
    public createQueryString(obj: Record<string, any>) {
        return new URLSearchParams(obj).toString();
    }

    public encodeToken(data: string): string {
        const publicKeyString = readFileSync('./public.pem', 'utf8'); // Menggunakan kunci publik

        const publicKey = new NodeRSA(publicKeyString);
        publicKey.setOptions({ encryptionScheme: "pkcs1", environment: "browser" });

        const encryptedData = publicKey.encrypt(data, 'base64');

        return encryptedData;
    }

    public decodeToken(encryptedToken: string): string {
        const privateKeyString = readFileSync('./private.pem', 'utf8');

        const privateKey  = new NodeRSA(privateKeyString);
        privateKey.setOptions({ encryptionScheme: "pkcs1", environment: "browser" });

        const decryptedRequestData = privateKey.decrypt(encryptedToken).toString("utf8");

        return decryptedRequestData;
    }

    public verifyToken(token: string, validUrlEndpoint: string, request: any): boolean {
        const body = JSON.parse(request || '{}');

        const expiredKey = EXPIRED_TIME_VERIFY_X_API_SECRET.EXPIRED_KEYS.find(expiredKey => {
            const regexKey = expiredKey.key.replace(/:\w+/g, '\\w+');
            const regex = new RegExp(`^${regexKey}$`);
            return regex.test(validUrlEndpoint); 
        });
        if(!expiredKey){
            console.log(`${token}: Invalid expiredKey`);
            return false
        }

        const splitToken = expiredKey.name == 'LOGIN_GOOGLE' ? token.split(':') : token.split('.');
        const timestamp = splitToken[0];
        const urlEndpoint = splitToken[1];

        if(expiredKey.name == 'WITHDRAW_GOPAY' || expiredKey.name == 'WITHDRAW_GOPAYID'){
            if(body.amount != splitToken[2]) {
                return false
            }
        }
        
        if(expiredKey.name == 'QUEST_FINISH' || expiredKey.name == 'MISSION_FINISH'){
            if(!splitToken[2] || !splitToken[3]){
                return false
            }
            if(body.values != splitToken[2]) {
                return false
            }
            if(body.reward_multiplier != splitToken[3]) {
                return false
            }
        }

        if(expiredKey.name == 'LOGIN_GOOGLE'){
            if(!splitToken[2] || !splitToken[3]){
                console.log(`${token}: Doesn't have index 2 and 3`);
                return false
            }
            if(body.email != splitToken[2]){
                console.log(`${token}: Body Email didn't same with index 2`);
                return false
            }
            if(body.google_id != splitToken[3]){
                console.log(`${token}: Body GoogleID didn't same with index 3`);
                return false
            }
        }

        if(expiredKey.name == 'FREEPLAY_FINISH'){
            if(!splitToken[2]){
                return false
            }
            if(body.values != splitToken[2]) {
                return false
            }
        }

        if(expiredKey.name == 'ADS_LOG'){
            if(body.source_code != splitToken[2]){
                return false
            }
            if(body.source_type != splitToken[3]){
                return false
            }
            if(body.status != splitToken[4]){
                return false
            }
            if(body.type != splitToken[5]){
                return false
            }
        }
    
        if (urlEndpoint !== validUrlEndpoint) {
            console.log(`${token}: url endpoint ${urlEndpoint} is not same with ${validUrlEndpoint}`);
            return false
        };
        
        const currentTime = Math.floor(Date.now() / 1000);
        const isExpired = (currentTime - parseInt(timestamp)) > expiredKey.value; // expirationTime is second
        if (isExpired) {
            console.log(`${token}: IS EXPIRED`)
            return false
        };
    
        return true
    }

    public withConnection = async <T>(handler: (connection: Connection) => Promise<T>): Promise<T> => {
        const connection = await new Database().getConnection();
        try {
            return await handler(connection);
        } finally {
            if (connection.isConnected) {
                console.log("CLOSING DB CONNECTION...");
                await connection.close();
            }
        }
    };

    public isDefaultUsername(username: string): boolean {
        const defaultUsernamePattern = /^Player_\d+$/;
        return defaultUsernamePattern.test(username);
    }

    public isAlphanumeric(input: string): boolean {
        return /^[a-zA-Z0-9]+$/.test(input);
    }

    public autoFixUsername(username: string): string {
        let cleaned = username.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Opsional: Hindari underscore di awal/akhir
        cleaned = cleaned.replace(/^_+|_+$/g, '');
        
        if (cleaned.length === 0) {
            cleaned = 'user' + Math.floor(Math.random() * 10000);
        }
        
        return cleaned;
    }
}
