import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';
import { Connection, DeleteResult, InsertResult, UpdateResult, Brackets, getManager, DeepPartial } from 'typeorm';
import { HelperService } from "./helper";
import { MidtransAccountValidationRequest, MidtransCreatePayoutRequest, MidtransApproveRequestRequest, MidtransCustomerTopupRequest } from "../interfaces/requests/midtrans";
import { MidtransAccountValidationResponse, MidtransCreatePayoutResponse, MidtransApprovePayoutResponse, MidtransResponseCode, MiniAppTokenResponse, MidtransAccessTokenResponse, MidtransDirectDebitResponse, MidtransCustomerTopupResponse } from '../interfaces/responses/midtrans';
import { MidtransPayoutLogs } from '../entities/midtrans-payout-logs';
import { Users } from "../entities/users";
import { Database } from '../database';
import { AppConfigService } from '../services/app-config';
import { APP_CONFIG_KEY } from "../config/app-config-constant";
import * as crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { int } from 'aws-sdk/clients/datapipeline';
import { ProcessCredentials } from 'aws-sdk';

export class MidtransService {
    public dbConn                       : Connection;
    public helperService                : HelperService;
    public url                          ?: string;
    public urlGopayMiniApp              ?: string;
    public apiKeyCreator                ?: string;
    public apiKeyApprover               ?: string;
    public clientKey                    ?: string;
    public serverKey                    ?: string;
    public accountValidationEndpoint    ?: string;
    public createPayoutEndpoint         ?: string;
    public approvePayoutEndpoint        ?: string;
    public miniAppTokenEndpoint         ?: string;
    public GopayClientCredential        ?: string;
    public accessTokenEndpoint          ?: string;
    public directDebitEndpoint          ?: string;
    public BISnapUrl                    ?: string;
    public BISnapClientKey              ?: string;
    public BISnapXSignatureClientSecret ?: string;
    public MerchantId                   ?: string;
    public ChannelId                    ?: string;
    public PopId                        ?: string;
    public customerTopupEndpoint        ?: string;
    public merchantOpenApiUrl           ?: string;

    /** MIDTRANS FLOW */
    // Account Validation
    // Ref: https://docs.midtrans.com/reference/validate-bank-account

    // Payout -> Create
    // Ref:  https://docs.midtrans.com/reference/create-payout

    // Payout -> Approve
    // Ref: https://docs.midtrans.com/reference/accept-payout

    constructor(Connection: Connection){
        this.dbConn = Connection;

        this.helperService      = new HelperService();
        this.url = process.env.MIDTRANS_URL;
        this.urlGopayMiniApp = process.env.GOPAY_MINIAPP_URL;
        this.apiKeyCreator = process.env.MIDTRANS_CREATOR_API_KEY;
        this.apiKeyApprover = process.env.MIDTRANS_APPROVER_API_KEY;
        this.clientKey = process.env.MIDTRANS_CLIENT_KEY;
        this.serverKey = process.env.MIDTRANS_SERVER_KEY;
        this.accountValidationEndpoint = process.env.MIDTRANS_ACCOUNTVALIDATION_ENDPOINT;
        this.createPayoutEndpoint = process.env.MIDTRANS_CREATEPAYOUT_ENDPOINT;
        this.approvePayoutEndpoint = process.env.MIDTRANS_APPROVEPAYOUT_ENDPOINT;
        this.miniAppTokenEndpoint = process.env.GOPAY_MINIAPPTOKEN_ENDPOINT;
        this.GopayClientCredential = process.env.GOPAY_CLIENT_CREDENTIAL;
        this.accessTokenEndpoint = process.env.MIDTRANS_ACCESS_TOKEN_ENDPOINT;
        this.directDebitEndpoint = process.env.MIDTRANS_DIRECT_DEBIT_ENDPOINT;
        this.BISnapUrl = process.env.MIDTRANS_BI_SNAP_URL;
        this.BISnapClientKey = process.env.MIDTRANS_BI_SNAP_CLIENT_KEY;
        this.BISnapXSignatureClientSecret = process.env.MIDTRANS_X_SIGNATURE_CLIENT_SECRET;
        this.MerchantId = process.env.MIDTRANS_MERCHANT_ID;
        this.ChannelId = process.env.MIDTRANS_CHANNEL_ID;
        this.PopId = process.env.MIDTRANS_POP_ID;
        this.customerTopupEndpoint = process.env.MIDTRANS_CUSTOMER_TOPUP_ENDPOINT;
        this.merchantOpenApiUrl = process.env.MIDTRANS_MERCHANT_OPENAPI_URL;
        
    }

    private checkConfiguration() {
        if (
            !this.url || 
            !this.urlGopayMiniApp || 
            !this.clientKey || 
            !this.serverKey || 
            !this.accountValidationEndpoint || 
            !this.createPayoutEndpoint || 
            !this.approvePayoutEndpoint || 
            !this.miniAppTokenEndpoint || 
            !this.GopayClientCredential || 
            !this.accessTokenEndpoint || 
            !this.directDebitEndpoint || 
            !this.BISnapUrl || 
            !this.BISnapClientKey || 
            !this.BISnapXSignatureClientSecret || 
            !this.MerchantId || 
            !this.PopId || 
            !this.customerTopupEndpoint || 
            !this.merchantOpenApiUrl
        ) throw Error("Midtrans ENV is not configured");
    }

    public async callAPIMiniApp(payload: object, endpoint: string, type: string, queryString: string): Promise <[success: boolean, message: string, data: any | undefined]>{
        this.checkConfiguration();
        const url = this.urlGopayMiniApp;

        let apiKey;
        apiKey = this.GopayClientCredential

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Basic ${apiKey}`
        };

        const fullUrl = `${url}${endpoint}`;

        console.log(payload);
        let response;
        const clientCert = fs.readFileSync(path.join(__dirname, '../../tls.crt'), 'utf8');
        const clientKey = fs.readFileSync(path.join(__dirname, '../../tls.key'), 'utf8');
        const gopayRootCA = fs.readFileSync(path.join(__dirname, '../../gopay-root-ca-production.crt'), 'utf8');

        console.log(`Cert Path: ${clientCert}`);
        console.log(`Key Path: ${clientKey}`);
        console.log(`CA Path: ${gopayRootCA}`);

            const axiosInstance = axios.create({
                httpsAgent: new https.Agent({
                    cert: clientCert,
                    key: clientKey,
                    ca: gopayRootCA
                }),
                headers
            });

        try {
            console.log("Sending request...");
            response = await axiosInstance.post(fullUrl, payload);
            console.log("Response received:", response.data);

            if (!response || !response.data) {
                console.log(headers);
                console.log(payload);
                console.log("Empty response:", response);
                return [false, "No valid response from Midtrans", undefined];
            }

            return [true, "API Processed", response.data];
        } catch (error) {
            if (axios.isAxiosError(error)) {
                // Menangkap response error dari server jika ada
                if (error.response) {
                    console.error("API Error Response:", error.response.data);
                    console.error("Status Code:", error.response.status);
                    console.error("Headers:", error.response.headers);
                    
                    return [false, `Error ${error.response.status}: ${error.response.data?.description || "Unknown error"}`, undefined];
                } else if (error.request) {
                    // Request dikirim tapi tidak ada response (misalnya timeout)
                    console.error("No response received:", error.request);
                    return [false, "No response received from API", undefined];
                } else {
                    // Error lain dalam konfigurasi atau pengiriman request
                    console.error("Axios Error:", error.message);
                    return [false, "Request failed: " + error.message, undefined];
                }
            } else {
                // Error lain di luar Axios (misalnya kesalahan kode di luar request API)
                console.error("Unexpected Error:", error);
                return [false, "Unexpected error occurred", undefined];
            }
        }
    }

    public async callAPI(
        payload: object, 
        endpoint: string, 
        type: string, 
        queryString: string,
        options: {
            accessToken?: string,
            path?: string
        } = { accessToken: "", path: "" }
    ): Promise <[success: boolean, message: string, data: any | undefined]>{
        this.checkConfiguration();
        const url = (type === "miniAppToken") 
            ? this.urlGopayMiniApp 
        : (type === "accessToken" || type === "directDebit") 
            ? this.BISnapUrl 
        : (type === "topup" || type === "merchantOpenApiAccessToken")
            ? this.merchantOpenApiUrl
        : this.url;

        if (!this.BISnapClientKey) {
            throw new Error("Client key is not configured");
        }
        const midtransPrivateKey = fs.readFileSync(path.join(__dirname, '../../midtrans-x-signature-private-key.pem'), 'utf8');

        let apiKey;
        if (type == "createpayout"){
            apiKey = this.apiKeyCreator
        } else if (type == "approvepayout"){
            apiKey = this.apiKeyApprover
        } else {
            apiKey = this.apiKeyCreator
        }

        let header: [string, string][] = [];

        if (type === "accessToken") {
            const timestamp = new Date().toISOString();
            const signature = this.generateAsymmetricSignature(this.BISnapClientKey, timestamp, midtransPrivateKey);

            header = [
                ["Content-Type", "application/json"],
                ["X-TIMESTAMP", timestamp],
                ["X-SIGNATURE", signature],
                ["X-CLIENT-KEY", this.BISnapClientKey]
            ];
        } else if( type === "merchantOpenApiAccessToken") {
            const midtransPrivateKeyTest = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDYN4TQinSk1pSW
JghfNKRoI5naTO91BricgyBmNYTHIYW+z9YwhQgw30eOnRhVLDBds7cSMcgG/AYb
8rzV4rOuTz1ZnDxC5l4hm7Q3vGKNvPY+uyorKY+snDCKidKaMiD0zZ+hWqd/9kJ4
4FUzghmQSolbezhH3s4S6r048x3h4uL3di14dnlAu/B4j9vm3Ikq4tSG5ZQKUTvh
zkAgZ7QQWWA1R/+Rz9FZ/lawcR4EUZ1xhFcAlt8x0XGTt00tyrJ6HtK/b72bVRrM
c93mWNe3MGC9VVv2nyu+NDCcIAauvmkspUqm8vQquoWyWN75Ev9ZxBHUDZCu6Wiv
U5/ceYnhAgMBAAECggEACP4gJENJ8CwrkGYjDYClQN6QMNPn1rRxm7LZd17M97JF
e4bt5+U0jsHOmlge0bYNiewmVlejM+UqBOIO6A9ufTa2/MHigL7PlfLBp1rKt43v
KPNEYPiwzNNPMofibj7c/4mI1N9uHYSaxafA62xDD20GMvuYPub9p6xDM/nqmYEw
Zhwv0n+a2NarBykvoKYaAIqVYbg+JOUf7NZKr567RH7WS4UnIknX3lDPKSnkPVJ5
kQ8Bm3vkL7lHd5eHwLxKPbkx8zwNusgsycA/KU2hUUCa5ptg+nlWzT/b+pHSi1A2
AE6JRmTav4KS7aDbRGfKMo9g/rO/xSuUMNrLXuro0QKBgQD7OFDAQUQsL6rLj/2g
wNrZFwTu37A5s4sLulsSfDub0qKkjyNvkumlkqjpPMo9TpxBo5O6QXyTbhBwsiBx
4UFTFVU2VrvGKJn84E2+WrXsiczn/3HPmYwRjd2XeZ2RLGtTdR7TG0Is/MdkXP7U
ppz1V6+bhUH0q468/+U61O+WeQKBgQDcVLROsq74PVMujR7xFdS7u89Av+vBrxpz
T1JZ9LczDqCEcB7psacc8q8lXxQjZVEoSWPD11uBu94xwTX+YFN3G2VQAy0UIeYm
E6+C+kTq9BrtoK1fV9sTvz6amOPLpMTWmgH2geMm/V0BneCi3n022FlkwsM0zbeR
1x0KHovUqQKBgAq9o6Y0pCeHejPt2hgvZqv1cf6MjcpJxN4hf5dQvHOzE8UZYZh5
nYe4t4QRV0w7ui6MQdqqxhq/j/BhjUWRLevRc605FBoqzjqjlG9ZDYIpehtJLqKD
nBt8B0dcqcH1NjmBPmokNjYaMKQ33aVV4kwTDa0Gi4VceGPYRQK46+1xAoGBAL6V
onXkiAcAfOBqf5ZIrQBK/4ZhvNuHzJhrx686R/GpOF324jaBTi1zGt93s+K+NApm
GR8BPQ0mZZeiKkNELU586xDf/nFItVzAcHQaadzWlChycSVkyIL3TX7Ku1ieyQlc
pFAHoGZMiNPqLbKUQ7laQVEwS0x0mdJUQbFMJOYpAoGAHR7c3EYV/w+afs9oUvpT
+SObMhFSA9EgvIb+Gp0cKzX3AH79rT0yfxg9nk08hnKsZaBiR9bKmjju58w6bQE9
WJNsyrjihFgS63jk4NFyXl0I6i2UZLkxg4146OqvxO1hdPzDPPoAXmO7aXJA3rd1
vFzDiwYOuP2I+yE0wyUBae0=
-----END PRIVATE KEY-----`;

            const timestamp = new Date().toISOString();
            const basePath = '/production';
            if (options.path && options.path.startsWith(basePath)) {
                const signature = this.generateAsymmetricSignature(this.BISnapClientKey, timestamp, midtransPrivateKey);

                header = [
                    ["Content-Type", "application/json"],
                    ["X-TIMESTAMP", timestamp],
                    ["X-SIGNATURE", signature],
                    ["X-CLIENT-KEY", this.BISnapClientKey]
                ];
            } else {
                const signature = this.generateAsymmetricSignature("qSbZaArw-GPS_AGGRE-SNAP", timestamp, midtransPrivateKeyTest);
                header = [
                    ["Content-Type", "application/json"],
                    ["X-TIMESTAMP", timestamp],
                    ["X-SIGNATURE", signature],
                    ["X-CLIENT-KEY", "qSbZaArw-GPS_AGGRE-SNAP"]
                ];
            }
        } else if( type === "directDebit") {
            if (!this.directDebitEndpoint || !this.customerTopupEndpoint || !this.BISnapXSignatureClientSecret || !options.accessToken || !this.MerchantId || !this.ChannelId) {
                throw new Error("Required parameters are missing");
            }

            const timestamp = new Date().toISOString();
            const externalId = uuidv4();
            const signature = this.generateSymmetricSignature({
                httpMethod: "POST",
                endpointUrl: this.directDebitEndpoint,
                accessToken: options.accessToken,
                requestBody: payload,
                clientSecret: this.BISnapXSignatureClientSecret,
                timestamps: timestamp,
            });

            header = [
                ["Content-Type", "application/json"],
                ["X-TIMESTAMP", timestamp],
                ["X-SIGNATURE", signature],
                ["Authorization", "Bearer " + options.accessToken],
                ["X-PARTNER-ID", this.MerchantId],
                ["X-EXTERNAL-ID", externalId],
                ["CHANNEL-ID", this.ChannelId]
            ];

        } else if(type === "topup") {
            if (!this.customerTopupEndpoint || !this.BISnapXSignatureClientSecret || !options.accessToken || !this.MerchantId || !this.ChannelId) {
                throw new Error("Required parameters are missing");
            }

            const timestamp = new Date().toISOString();
            const externalId = uuidv4();
            const basePath = '/production';
            if (options.path && options.path.startsWith(basePath)) {
                const signature = this.generateSymmetricSignature({
                    httpMethod: "POST",
                    endpointUrl: this.customerTopupEndpoint,
                    accessToken: options.accessToken,
                    requestBody: payload,
                    clientSecret: this.BISnapXSignatureClientSecret,
                    timestamps: timestamp,
                });

                header = [
                    ["Content-Type", "application/json"],
                    ["X-TIMESTAMP", timestamp],
                    ["X-SIGNATURE", signature],
                    ["Authorization", "Bearer " + options.accessToken],
                    ["X-PARTNER-ID", this.MerchantId],
                    ["X-EXTERNAL-ID", externalId],
                    ["CHANNEL-ID", this.ChannelId]
                ];
            } else {
                const signature = this.generateSymmetricSignature({
                    httpMethod: "POST",
                    endpointUrl: this.customerTopupEndpoint,
                    accessToken: options.accessToken,
                    requestBody: payload,
                    clientSecret: "3Jhp4aaTof&wPrK4xizOO&1c1uX9Du@kQoI$p%zYNT&n1#aw6lf6k1SI0M#oVrhs&V6kjI9soxvLFFkBSeJXF#ccridM*3U$JUElfw8k!kd!WFZ7RHC1zxZ^ky1TiknU",
                    timestamps: timestamp,
                });

                header = [
                    ["Content-Type", "application/json"],
                    ["X-TIMESTAMP", timestamp],
                    ["X-SIGNATURE", signature],
                    ["Authorization", "Bearer " + options.accessToken],
                    ["X-PARTNER-ID", "G221085593"],
                    ["X-EXTERNAL-ID", externalId],
                    ["CHANNEL-ID", this.ChannelId]
                ];
            }
        } else {
            header = [
                ["Content-Type",    "application/json"],
                ["Accept",          "application/json"],
                ["Authorization", "Basic " + Buffer.from(apiKey + ":").toString('base64')]
            ];
        }

        const fullUrl = `${url}${endpoint}?${queryString}`;

        console.log(payload);
        let response;
        try {
            if (type == 'accountvalidation') {
                response = await this.helperService.getMidtrans<MidtransAccountValidationResponse>(
                    fullUrl,
                    header
                );
            } else if (type == "createpayout"){
                response = await this.helperService.post<MidtransCreatePayoutResponse>(
                    fullUrl,
                    payload, 
                    header
                );
            } else if (type == "approvepayout") {
                response = await this.helperService.post<MidtransApprovePayoutResponse>(
                    fullUrl,
                    payload, 
                    header
                );
            } else if (type == "accessToken" || type == "merchantOpenApiAccessToken") {
                response = await this.helperService.post<MidtransAccessTokenResponse>(
                    fullUrl,
                    payload, 
                    header
                );
            } else if (type == "directDebit") {
                response = await this.helperService.post<MidtransDirectDebitResponse>(
                    fullUrl,
                    payload, 
                    header
                );
            } else if( type == "topup") {
                response = await this.helperService.post<MidtransCustomerTopupResponse>(
                    fullUrl,
                    payload, 
                    header
                );
            }

            if (!response?.parsedBody) {
                console.log(header);
                console.log(payload);
                console.log(response);
                return [false, "No responses from Midtrans", undefined];
            }

            const parsedBody = response.parsedBody;

            return [true, "API Processed", parsedBody];

            

            // if (parsedBody.status_code == MidtransResponseCode.success || parsedBody.status_code == MidtransResponseCode.pending) {
            //     return [true, "API Processed", parsedBody];
            // }
            // console.log(response, parsedBody);
            // console.log("Call Midtrans API Failed. Something wrong with the API [1]");

            // return [false, "Something wrong with the API [1]", parsedBody]; 
        } catch (error: any) {
            console.log(error);
            console.log("Call Midtrans API Failed. Something wrong with the API [2]");

            if (error instanceof Response) {
                console.error("Response Status:", error.status);
                console.error("Response Headers:", JSON.stringify([...error.headers]));
                error.text().then((text) => {
                    console.error("Response Body:", text);
                });
            } else {
                console.error("Error Message:", error.message);
            }

            return [false, "Something wrong with the API [2]", undefined]; 
        }
    }

    public async accountValidation(input: MidtransAccountValidationRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        const queryString = new URLSearchParams(Object.entries(input)).toString();

        const payload = {};

        const [success, message, data] = await this.callAPI(payload, `${this.accountValidationEndpoint}`, "accountvalidation", queryString);

        return {success, data};
    }

    public async createPayout(input: MidtransCreatePayoutRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        const payload = {
            "payouts": input.payouts
        };

        const [success, message, data] = await this.callAPI(payload, `${this.createPayoutEndpoint}`, "createpayout", "");

        return {success, data};
    }

    public async approvePayout(input: MidtransApproveRequestRequest): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        const payload = {
            "reference_nos": input.reference_nos
        };

        const [success, message, data] = await this.callAPI(payload, `${this.approvePayoutEndpoint}`, "approvepayout", "");

        return {success, data};
    }

    public async midtransMerchantOpenApiAccessToken(path: string): Promise<{success: boolean, data: any}> {
        this.checkConfiguration();
        
        const payload = {
            "grantType": "client_credentials"
        };

        const [success, message, data] = await this.callAPI(payload, `${this.accessTokenEndpoint}`, "merchantOpenApiAccessToken", "", {path});

        return {success, data};
    }

    public async customerTopup(input: MidtransCustomerTopupRequest, accessToken: string, path: string): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        const [success, message, data] = await this.callAPI(input, `${this.customerTopupEndpoint}`, "topup", "", {accessToken, path});

        return {success, data};
    }

    public async miniAppToken(auth_code: string): Promise<{success: boolean, data: any}>{
        this.checkConfiguration();

        const payload = {
            "auth_code": auth_code
        };

        const [success, message, data] = await this.callAPIMiniApp(payload, `${this.miniAppTokenEndpoint}`, "miniAppToken", "");

        return {success, data};
    }

    public async midtransAccessToken(): Promise<{success: boolean, data: any}> {
        this.checkConfiguration();
        
        const payload = {
            "grantType": "client_credentials"
        };

        const [success, message, data] = await this.callAPI(payload, `${this.accessTokenEndpoint}`, "accessToken", "");

        return {success, data};
    }

    public async midtransDirectDebit(user: Users, product: any, accessToken: string, orderId: string): Promise<{success: boolean, data: any}> {
        this.checkConfiguration();
        const connection            = await new Database().getConnection();
        const appConfigsService     = new AppConfigService(connection);
        const webviewUrl            = await appConfigsService.getConfigByKey(APP_CONFIG_KEY.webviewUrl);
        const webviewShopPayMethod  = await appConfigsService.getConfigByKey(APP_CONFIG_KEY.webviewShopPayMethod);

        if (!webviewUrl || !webviewShopPayMethod) {
            throw new Error("Required config values are missing");
        }
        
        const payload = {
            "partnerReferenceNo": orderId,
            "chargeToken": accessToken,
            "urlParam": [
                {
                    "url": webviewUrl.config_value || "",
                    "type": "PAY_RETURN",
                    "isDeeplink": "Y"
                }
            ],
            "payOptionDetails": [
                {
                    "payMethod": webviewShopPayMethod.config_value || "",
                    "payOption": webviewShopPayMethod.config_value || "",
                    "transAmount": {
                        "value": product.price.toFixed(2),
                        "currency": "IDR"
                    }
                }
            ],
            "additionalInfo": {
                "customerDetails": {
                    "phone":user.phone_number || "",
                    "firstName": user.name || user.username || "",
                    "email": user.email || ""
                },
                "items": [
                    {
                        "id": product.ext_product_id,
                        "price": {
                            "value": product.price.toFixed(2),
                            "currency": "IDR"
                        },
                        "quantity": "1",
                        "name": product.name
                    }
                ],
                // "pointOfPurchaseId": "ca1807fa-120e-41ea-a9ef-eb45090486a9"
                "pointOfPurchaseId": this.PopId
            }
        };

        const [success, message, data] = await this.callAPI(payload, `${this.directDebitEndpoint}`, "directDebit", "", {accessToken});

        return {success, data};
    }

    public async storeMidtransPayoutLogs(schema: DeepPartial<MidtransPayoutLogs>): Promise<MidtransPayoutLogs> {
        return await this.dbConn.getRepository(MidtransPayoutLogs).save(schema);
    }

    public async verifyWebhookSignature(req: any): Promise<boolean> {
        try {
            const midtransPublicKey = fs.readFileSync(path.join(__dirname, '../../midtrans-x-signature-public-key.pem'), 'utf8');

            const partnerId = req.headers['X-PARTNER-ID'] || 
                         req.headers['x-partner-id'] || 
                         req.headers['X-Partner-Id'] || '';
            
            const signature = req.headers['X-SIGNATURE'] || 
                         req.headers['x-signature'] || 
                         req.headers['X-Signature'] || '';
                         
            const timestamp = req.headers['X-TIMESTAMP'] || 
                            req.headers['x-timestamp'] || 
                            req.headers['X-Timestamp'] || '';

            if (!signature || !timestamp || !partnerId) {
                console.log('Missing required headers:', { 
                    headers: req.headers,
                    signature,
                    timestamp 
                });
                return false;
            }

            if(partnerId != this.MerchantId){
                console.log('Wrong partnerId:', { 
                    partnerId
                });
            }
            
            const isValid = this.verifyAsymmetricSignature({
                httpMethod: 'POST',
                endpointUrl: '/v1.0/debit/notify', 
                requestBody: req.body,
                timestamp: timestamp,
                signature: signature,
                publicKeyPem: midtransPublicKey
            });
    
            return isValid;
        } catch (error) {
            console.error('Error verifying signature:', error);
            return false;
        }
    }

    private verifyAsymmetricSignature({
        httpMethod,
        endpointUrl,
        requestBody,
        timestamp,
        signature,
        publicKeyPem
    }: {
        httpMethod: string;
        endpointUrl: string;
        requestBody: Record<string, any> | string;
        timestamp: string;
        signature: string;
        publicKeyPem: string;
    }): boolean {
        try {
            // Step 1: Minify JSON body
            const minifiedBody = typeof requestBody === 'string'
                ? requestBody.replace(/\s+/g, '')
                : JSON.stringify(requestBody);

            // Step 2: Create SHA-256 hash of minified body
            const hashedBody = crypto
                .createHash('sha256')
                .update(minifiedBody)
                .digest('hex')
                .toLowerCase();

            // Step 3: Create stringToSign format: HTTPMethod + ":" + EndpointUrl + ":" + HashedBody + ":" + TimeStamp
            const stringToSign = [
                httpMethod.toUpperCase(),
                endpointUrl,
                hashedBody,
                timestamp
            ].join(':');

            // Step 4: Verify signature
            const publicKey = crypto.createPublicKey({
                key: publicKeyPem,
                format: "pem",
                type: "pkcs1",
            });

            return crypto.verify(
                "sha256",
                Buffer.from(stringToSign),
                publicKey,
                Buffer.from(signature, 'base64')
            );
        } catch (error) {
            console.error("Signature verification failed:", error);
            return false;
        }
    }

    private generateAsymmetricSignature(clientKey: string, timestamp: string, privateKeyPem: string): string {
        const signData = `${clientKey}|${timestamp}`;
        
        // Load private key
        const privateKey = crypto.createPrivateKey({
            key: privateKeyPem,
            format: "pem",
            type: "pkcs1",
        });
    
        // Sign the data using SHA256withRSA
        const signature = crypto.sign("sha256", Buffer.from(signData), privateKey);
    
        // Encode to base64
        return signature.toString("base64");
    }

    /**
     * Generate Midtrans HMAC-SHA512 Symmetric Signature
     * 
     * @param httpMethod - e.g. "POST"
     * @param endpointUrl - e.g. "/v1/qrqr-mpm-generate"
     * @param accessToken - Access token (without "Bearer " prefix)
     * @param requestBody - Request body object (will be minified and hashed)
     * @param clientSecret - Client Secret for HMAC
     * @param timestamp - ISO timestamp string (e.g. "2025-03-10T08:23:28.504Z")
     * @returns HMAC-SHA512 signature string
     */
    private generateSymmetricSignature({
        httpMethod,
        endpointUrl,
        accessToken,
        requestBody,
        clientSecret,
        timestamps,
    }: {
        httpMethod: string;
        endpointUrl: string;
        accessToken: string;
        requestBody: Record<string, any> | string;
        clientSecret: string;
        timestamps: string;
    }): string {
        // Step 1: Minify JSON body (if object, stringify it first)
        const minifiedBody = typeof requestBody === 'string'
        ? requestBody.replace(/\s+/g, '')
        : JSON.stringify(requestBody);
    
        // Step 2: SHA-256 hash of minified body → hex → lowercase
        const hashedBody = crypto.createHash('sha256').update(minifiedBody).digest('hex').toLowerCase();
    
        // Step 3: Concatenate stringToSign
        const stringToSign = [
        httpMethod.toUpperCase(),
        endpointUrl,
        accessToken,
        hashedBody,
        timestamps,
        ].join(':');
    
        // Step 4: Generate HMAC SHA512 signature using clientSecret
        const hmac = crypto.createHmac('sha512', clientSecret);
        hmac.update(stringToSign);
        const signature = hmac.digest('base64');
    
        return signature;
    }
}