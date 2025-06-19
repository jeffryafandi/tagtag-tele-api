import { CheckBillingRequest, FetchOperatorFilterRequest, OperatorStatusEnum, StoreUserOperatorPurchaseRequest } from "../interfaces/requests/operator";
import { Operators } from "../entities/operators";
import { BaseService } from "./base";
import { Connection } from "typeorm";
import { AwdService } from "./awd";
import { Users } from "../entities/users";
import { AwdProcessType } from "../interfaces/requests/awd";
import { OperatorPurchases } from "../entities/operator-purchases";
import { UserService } from "./user";
import { TransactionService } from "./transaction";
import { TRANSACTION_DESCRIPTIONS } from "../config/constants";
import { TransactionAvailableCodeEnum, TransactionDetailCurrencyEnum, TransactionDetailRequest } from "../interfaces/requests/transaction";
import { EmailService } from "./email";
import { NotificationService } from "./fcm-notification";
import { NOTIF_CODE } from "../config/notif-constant";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

export class OperatorService extends BaseService {
    protected awdService            : AwdService;
    protected transactionService    : TransactionService;    
    protected emailService          : EmailService;

    constructor(connection: Connection) {
        super(connection);
        this.awdService             = new AwdService(connection);
        this.transactionService     = new TransactionService(connection);
        this.emailService           = new EmailService();
    }

    public async fetchOperatorList(filter: FetchOperatorFilterRequest|undefined = undefined): Promise<Operators[]> {
        const operatorRepository = this.dbConn.getRepository(Operators)
        .createQueryBuilder()
        .where('is_shown = 1');
        
        if (filter?.group_name) {
            operatorRepository.andWhere('group_name = :groupName', { groupName: filter.group_name })
        }
        if (filter?.vendor) {
            operatorRepository.andWhere('vendor = :vendor', {vendor: filter.vendor});
        }
        
        operatorRepository.limit(250);
        return operatorRepository.getMany();
    }

    public async fetchOperatorById(operatorId: number): Promise<Operators | null> {
        return await this.dbConn.getRepository(Operators).findOne({where: {id: operatorId}});
    }

    public async fetchOperatorPurchaseByTrxId(trxId: string): Promise<OperatorPurchases | null> {
        return await this.dbConn.getRepository(OperatorPurchases).findOne({
            where   : {
                trx_id: trxId
            },
            join    : {
                alias               : 'operatorPurchase',
                leftJoinAndSelect   : {
                    operator: 'operatorPurchase.operator',
                    user    : 'operatorPurchase.user'
                }
            }
        });
    }

    public async updateOperatorPurchase(operatorPurchase: number | OperatorPurchases, schema: QueryDeepPartialEntity<OperatorPurchases>) {
        let operatorId      = operatorPurchase;

        if (isNaN(Number(operatorPurchase))) {
            operatorPurchase= operatorPurchase as OperatorPurchases;
            operatorId      = operatorPurchase.id;
        }

        await this.dbConn.getRepository(OperatorPurchases)
        .createQueryBuilder()
        .update(OperatorPurchases)
        .set(schema)
        .where('id = :operatorId', {operatorId})
        .execute();
    }

    public async mapOperatorData(filter: FetchOperatorFilterRequest | undefined = undefined) {
        return (await this.fetchOperatorList(filter)).map((op) => {
            return {
                id          : op.id,
                name        : op.name,
                description : op.description,
                denom       : op.denom,
                price       : op.price
            }
        });
    }

    public async checkAccountBilling(payload: CheckBillingRequest) {
        const operator = await this.fetchOperatorById(payload.operator_id);
        if (!operator) throw Error('Operator not found');

        const response = await this.awdService.checkBill({product_id: operator.code, msisdn: payload.account_number});
        return response;
    }

    public async storeUserOperatorPurchase(user: Users, operator: Operators, payload: StoreUserOperatorPurchaseRequest): Promise<OperatorPurchases> {
        return await this.dbConn.getRepository(OperatorPurchases).save({
            user_id         : user.id,
            operator_id     : operator.id,
            trx_id          : payload.trx_id,
            account_number  : payload.account_number,
            status          : payload.status
        });
    }

    public async userPayBilling(user: Users, payload: CheckBillingRequest): Promise<boolean> {
        const operator = await this.fetchOperatorById(payload.operator_id);
        if (!operator || operator.vendor !== 'awd') throw Error('Operator is not found');

        if (!['pln', 'pam'].includes(operator.group_name) && payload.account_number.indexOf('0') === -1) {
            payload.account_number = `0${payload.account_number}`;
        }

        let internalTrxId   = '';
        let awdSuccess      = false;
        let awdResponse: any= {};
        let operatorStatus  = OperatorStatusEnum.FAILED;
        let reducedAmount   = 0;
        const baseAwdPayload= {
            product_id  : operator.code,
            msisdn      : payload.account_number
        };

        switch (operator.type) {
            case AwdProcessType.pay:
                const checkBillResponse = await this.awdService.checkBill(baseAwdPayload);
                if (checkBillResponse.data.amount > user.coins) throw Error('User does not have enough coins to continue');
                internalTrxId  = checkBillResponse.data.partner_trxid;
                awdResponse    = checkBillResponse.data;
                if (checkBillResponse.success) {
                    const payBillResponse   = await this.awdService.payBill({...baseAwdPayload, amount: checkBillResponse.data.amount});
                    internalTrxId           = payBillResponse.data.partner_trxid
                    awdResponse             = payBillResponse.data;
                    reducedAmount           = payBillResponse.data.amount;
                    if (payBillResponse.success) {
                        awdSuccess      = true;
                        operatorStatus  = OperatorStatusEnum.SUCCESS
                    }
                }
                break;
            
            default:
                if (operator.price > user.coins) throw Error('User does not have enough coins to continue');
                const prepaidResponse   = await this.awdService.prepaid(baseAwdPayload);
                internalTrxId           = prepaidResponse.data.partner_trxid;
                awdResponse             = prepaidResponse.data;
                reducedAmount           = operator.price;

                if (prepaidResponse.success) {
                    awdSuccess      = true;
                    operatorStatus  = (awdResponse.sn) ? OperatorStatusEnum.SUCCESS : OperatorStatusEnum.PENDING
                }
                break;
        }

        const data = {
            trx_id          : internalTrxId, 
            status          : operatorStatus, 
            account_number  : payload.account_number
        }
        const operatorPurchase = await this.storeUserOperatorPurchase(user, operator, data);
        await this.awdService.storeAwdLogs({
            logable_tab         : 'operator_purchases',
            logable_tab_id      : operatorPurchase.id,
            type                : operator.type,
            json_response       : JSON.stringify(awdResponse)
        }, user);

        let notifCode               = NOTIF_CODE.PURCHASE_MOBILE_FAIL;
        let notificationParams: any = {
            operator: {
                group_name  : operator.group_name,
                denom       : operator.denom
            },
            account_name    : user.username,
            account_number  : payload.account_number
        }

        if (operatorStatus !== OperatorStatusEnum.FAILED) {
            await this.dbConn.getRepository(Users)
            .createQueryBuilder()
            .update(Users)
            .set({coins: (user.coins - reducedAmount)})
            .where('id = :userId', { userId: user.id })
            .execute();

            const updatedUser = await this.dbConn.getRepository(Users).findOne({
                where: {
                   id: user.id
                }
            });

            const transactionRequest = {
                description : TRANSACTION_DESCRIPTIONS.IN_APP_PURCHASE,
                code        : TransactionAvailableCodeEnum.USER_PURCHASE,
                extras      : JSON.stringify({data: {operator_purchases: {status: operatorStatus, amount: reducedAmount, currency: TransactionDetailCurrencyEnum.COIN}}}),
                details     : [{
                    type            : 'DB',
                    currency        : TransactionDetailCurrencyEnum.COIN,
                    value           : reducedAmount,
                    current_value   : updatedUser?.coins || 0,
                    previous_value  : user.coins
                }] as TransactionDetailRequest[]
            }

            if (operatorStatus === OperatorStatusEnum.SUCCESS) {
                if (!['pln', 'pam'].includes(operator.group_name)) {
                    notifCode = NOTIF_CODE.PURCHASE_MOBILE_SUCCESS;
                    await this.emailService.sendPulsaSuccess(user, operator, operatorPurchase);
                }
                if (['pln'].includes(operator.group_name)) {
                    notifCode = NOTIF_CODE.PURCHASE_PLN_SUCCESS;
                    notificationParams = {...notificationParams, pln_token: this.awdService.fetchPLNTokenFromSN(awdResponse?.sn || '')}
                    transactionRequest.extras = JSON.stringify({
                        data: {
                            operator_purchases: {
                                status      : operatorStatus, 
                                amount      : reducedAmount, 
                                currency    : TransactionDetailCurrencyEnum.COIN, 
                                pln_token   : this.awdService.fetchPLNTokenFromSN(awdResponse?.sn || '')
                            }
                        }
                    });

                    await this.emailService.sendPLNSuccess(user, operator, operatorPurchase);
                }
                if (['pam'].includes(operator.group_name)) {
                    notifCode = NOTIF_CODE.PURCHASE_PAM_SUCCESS;
                    await this.emailService.sendPDAMSuccess(user, operator, operatorPurchase);
                }
            }

            await this.transactionService.storeUserTransaction(user, transactionRequest);
        }

        if (operatorStatus === OperatorStatusEnum.FAILED) {
            if (!['pln', 'pam'].includes(operator.group_name)) {
                notifCode = NOTIF_CODE.PURCHASE_MOBILE_FAIL;
                await this.emailService.sendPulsaFailed(user, operator);
            }
            if (['pln'].includes(operator.group_name)) {
                notifCode = NOTIF_CODE.PURCHASE_PLN_FAIL;
                await this.emailService.sendPLNFailed(user, operator, operatorPurchase);
            }
            if (['pam'].includes(operator.group_name)) {
                notifCode = NOTIF_CODE.PURCHASE_PAM_FAIL;
                await this.emailService.sendPDAMFailed(user, operator);
            }                
        }

        const notificationService = new NotificationService(this.dbConn);
        await notificationService.sendNotificationByCode(notifCode, notificationParams, [`${user.id}`]);
        return (operatorStatus !== OperatorStatusEnum.FAILED);
    }
    public async handleOperatorPurchaseAWDWebhook(ourTrxId: string, isSuccess: boolean, message: string = ''): Promise<{status: string}> {
        const userService       = new UserService(this.dbConn);
        const operatorPurchase  = await this.fetchOperatorPurchaseByTrxId(ourTrxId);
        if (!operatorPurchase) throw Error('No purchase found!');

        let status                  = operatorPurchase.status;
        let notifCode               = NOTIF_CODE.PURCHASE_MOBILE_FAIL;
        let notificationParams: any = {
            operator: {
                group_name  : operatorPurchase.operator.group_name,
                denom       : operatorPurchase.operator.denom
            },
            account_name    : operatorPurchase.user.username,
            account_number  : operatorPurchase.account_number
        }

        if (!isSuccess) {
            if ([OperatorStatusEnum.SUCCESS, OperatorStatusEnum.PENDING].includes(operatorPurchase.status as OperatorStatusEnum)) {
                const refundedPrice = operatorPurchase.operator.price;
                status              = OperatorStatusEnum.REFUND;
                await userService.update(operatorPurchase.user_id, {coins: operatorPurchase.user.coins + refundedPrice});
                const updatedUser = await userService.getUser(operatorPurchase.user);
                await this.transactionService.storeUserTransaction(operatorPurchase.user, {
                    description : TRANSACTION_DESCRIPTIONS.IN_APP_PURCHASE,
                    code        : TransactionAvailableCodeEnum.USER_PURCHASE,
                    extras      : JSON.stringify({data: {operator_purchases: {status: OperatorStatusEnum.REFUND, amount: refundedPrice, currency: TransactionDetailCurrencyEnum.COIN}}}),
                    details     : [{
                        type            : 'CR',
                        currency        : TransactionDetailCurrencyEnum.COIN,
                        value           : refundedPrice,
                        previous_value  : operatorPurchase.user.coins,
                        current_value   : updatedUser?.coins || 0
                    }]
                });
                notifCode = (operatorPurchase.operator.group_name === 'pln') ? NOTIF_CODE.PURCHASE_PLN_FAIL : NOTIF_CODE.PURCHASE_MOBILE_FAIL;
            }
        } else {
            if (operatorPurchase.status !== OperatorStatusEnum.SUCCESS) {
                status                  = OperatorStatusEnum.SUCCESS;
                let transactionExtras   = {};

                if (operatorPurchase.operator.group_name === 'pln') {
                    const plnToken      = this.awdService.fetchPLNTokenFromSNCallback(message);
                    notifCode           = NOTIF_CODE.PURCHASE_PLN_SUCCESS;
                    notificationParams  = {...notificationParams, pln_token: plnToken}
                    transactionExtras   = {data: {operator_purchases: {status, pln_token: plnToken}}}
                } else {
                    notifCode           = NOTIF_CODE.PURCHASE_MOBILE_SUCCESS;
                }
                
                if (Object.keys(transactionExtras)) {
                    await this.transactionService.storeUserTransaction(operatorPurchase.user, {
                        description : TRANSACTION_DESCRIPTIONS.IN_APP_PURCHASE,
                        code        : TransactionAvailableCodeEnum.USER_PURCHASE,
                        extras      : JSON.stringify(transactionExtras),
                        details     : []
                    });
                }
            }

        }

        if (operatorPurchase.status !== status) {
            await this.updateOperatorPurchase(operatorPurchase.id, {status});
            await this.awdService.storeAwdLogs({
                logable_tab         : 'operator_purchases',
                logable_tab_id      : operatorPurchase.id,
                type                : `${operatorPurchase.operator.type}_webhook`,
                json_response       : JSON.stringify({status, msg: message})
            }, operatorPurchase.user);
            const notificationService = new NotificationService(this.dbConn);
            await notificationService.sendNotificationByCode(notifCode, notificationParams, [`${operatorPurchase.user_id}`]);
        }

        return {status};
    }
}
