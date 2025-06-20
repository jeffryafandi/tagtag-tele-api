import { DeepPartial, Transaction, createQueryBuilder } from "typeorm";
import { Transactions } from "../entities/transactions";
import { BaseService } from "./base";
import { TransactionDetails } from "../entities/transaction-details";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Users } from "../entities/users";
import { FilterTransaction, UserStoreNewTransactionRequest } from "../interfaces/requests/transaction";
import { UserService } from "./user";
import { ROWS_PER_PAGE } from "../config/constants";


export class TransactionService extends BaseService {
    public async storeNewTransaction(schema: DeepPartial<Transactions>): Promise<Transactions> {
        return await this.dbConn.getRepository(Transactions)
        .save(schema);
    }

    public async storeNewTransactionDetails(schema: QueryDeepPartialEntity<TransactionDetails>[]) {
        await this.dbConn.getRepository(TransactionDetails)
        .createQueryBuilder()
        .insert()
        .into(TransactionDetails)
        .values(schema)
        .execute();
    }

    // 
    public async getTransactionsByCurrencyAndPeriod(currency: string, startDate: string, endDate: string, userId?: number[], limit?: number): Promise<{raw: any[]}> {
        const userService   = new UserService(this.dbConn);
        // const data          = await userService.findBannedUserIds();
        const bannedUsers = await userService.findBannedUserIds();
        const bannedUserIds = bannedUsers.map((u) => u.user_id);
        const excludedUserIds = Array.from(new Set([...bannedUserIds, ...(userId || [])]));


        const query         = this.dbConn.createQueryBuilder()
                            .select('(@cnt := @cnt + 1)', 'position')
                            .addSelect('t.*')
                            .from((sq) => {
                                sq.select(['transaction.user_id'])
                                .addSelect('SUM(transactionDetails.value)', 'total_value')
                                .from(TransactionDetails, 'transactionDetails')
                                .leftJoin('transactionDetails.transaction', 'transaction')
                                .leftJoinAndSelect('transaction.user', 'user')
                                // .groupBy('transaction.user_id')
                                // .orderBy('total_value', 'DESC')
                                .where('transactionDetails.type="CR"')
                                .andWhere('transactionDetails.currency = :currency', {currency})
                                .andWhere('transactionDetails.created_at BETWEEN :startDate and :endDate', {startDate, endDate});
                                // Filter banned users
                                // if (data.length) {
                                //     const userIds = data.map((data) => {
                                //         return data.user_id;
                                //     });
                        
                                //     sq.andWhere('transaction.user_id NOT IN(:...userIds)', {userIds})
                                // }
                                // // Filter additional user IDs if provided
                                // if (userId && userId.length > 0) {
                                //     sq.andWhere('transaction.user_id NOT IN(:...userId)', {userId})
                                // }

                                if (excludedUserIds.length > 0) {
                                    sq.andWhere('transaction.user_id NOT IN (:...excludedUserIds)', { excludedUserIds });
                                }

                                sq.groupBy('transaction.user_id')
                                .orderBy('total_value', 'DESC');

                                if (limit && limit > 0) {
                                    sq.limit(limit);
                                }
                                
                                return sq;
                            }, 't')
                            .innerJoin('(SELECT @cnt := 0)', 'dummy');
        
        return {raw: await query.getRawMany()};
    }

    public async getUserTransactionsByCurrencyAndPeriod(user: Users, currency: string, startDate: string, endDate: string): Promise<{entities: TransactionDetails[], raw: any[]}> {
        return await this.dbConn.getRepository(TransactionDetails)
        .createQueryBuilder('transactionDetails')
        .select(['transaction.user_id'])
        .addSelect('SUM(transactionDetails.value)', 'total_value')
        .leftJoin('transactionDetails.transaction', 'transaction')
        .leftJoinAndSelect('transaction.user', 'user')
        .where('transactionDetails.type="CR"')
        .andWhere('transaction.user_id = :userId', {userId: user.id})
        .andWhere('transactionDetails.currency = :currency', {currency})
        .andWhere('transactionDetails.created_at BETWEEN :startDate and :endDate', {startDate, endDate})
        .getRawAndEntities();
    }

    public async storeUserTransaction(user: Users | number, payload: UserStoreNewTransactionRequest) {
        let userId = user;
        if (isNaN(Number(user))) {
            user    = user as Users;
            userId  = user.id
        }

        const transaction   = await this.storeNewTransaction({...payload, user_id: Number(userId)});
        const details       = await this.storeNewTransactionDetails(payload.details.map((detail): QueryDeepPartialEntity<TransactionDetails>  => {
            return {...detail, transaction_id: transaction.id}
        }));
        return true;
    }


    public async getTotalCurrency(currency: string | Array<string>, startDate: string, endDate: string, type: 'CR' | 'DB' = 'CR', includes_codes: string[] = [] ) {
        const query = this.dbConn.getRepository(TransactionDetails)
        .createQueryBuilder('transactionDetails')
        .leftJoinAndSelect('transactionDetails.transaction', 'transaction')
        .select('SUM(transactionDetails.value)', 'total_value')
        .addSelect('COUNT(transactionDetails.value)', 'total_count')
        .where('transactionDetails.type = :type', {type})
        .andWhere('transactionDetails.created_at BETWEEN :startDate and :endDate', {startDate, endDate});
        
        if (typeof currency == 'string') {
            query.andWhere('transactionDetails.currency = :currency', {currency});
        } else {
            query.andWhere('transactionDetails.currency IN(:...currency)', {currency});
        }

        if (includes_codes.length > 0) {
            query.andWhere('transaction.code IN(:...includes_codes)', {includes_codes});
        }

        console.log(query.getQuery());
        console.log(includes_codes);
        console.log(startDate, endDate, currency, type);
        return await query.getRawOne();
    }

    // public async getTotalCoinExcludePrizepool(currency: string | Array<string>, startDate: string, endDate: string, type: 'CR' | 'DB' = 'CR',  includes_codes: string[] = [] ) {
    //     const query = this.dbConn.getRepository(TransactionDetails)
    //     .createQueryBuilder('transactionDetails')
    //     .leftJoinAndSelect()
    //     .select('SUM(transactionDetails.value)', 'total_value')
    //     .addSelect('COUNT(transactionDetails.value)', 'total_count')
    //     .where('transactionDetails.type = :type', {type})
    //     .andWhere('transactionDetails.code = :type')
    //     .andWhere('transactionDetails.created_at BETWEEN :startDate and :endDate', {startDate, endDate});
        
    //     if (typeof currency == 'string') {
    //         query.andWhere('transactionDetails.currency = :currency', {currency});
    //     } else {
    //         query.andWhere('transactionDetails.currency IN(:...currency)', {currency});
    //     }
    //     return await query.getRawOne();
    // }

    public async userHistoryLogTransaction(input: FilterTransaction | null, startDate: string, endDate: string): Promise <[Transactions[], number]> {
        const logs = this.dbConn.getRepository(Transactions)
                    .createQueryBuilder('transaction')
                    .leftJoinAndSelect('transaction.user', 'user')
                    .leftJoinAndSelect('transaction.details', 'details')
                    .select([
                        'transaction.id',
                        'transaction.user_id',
                        'user.username as username',
                        'transaction.description',
                        'transaction.code',
                        'transaction.extras',
                        'details.value',
                        'details.type',
                        'details.currency',
                        'transaction.created_at',
                        'transaction.updated_at'
                    ])
                    .where('transaction.deleted_at is NULL')
                    

         if(input != null){
            if(input.username){
                logs.andWhere('user.username = :username', {username: input.username})
            }
            if(startDate || endDate){
                logs.andWhere('transaction.created_at BETWEEN :startDate and :endDate', {startDate: startDate, endDate: endDate })
            }
            if(input.page){
                logs.offset((input.page - 1) * ROWS_PER_PAGE)
                .limit(ROWS_PER_PAGE)
            }
        }

        const raw =  await logs.getRawMany();
        // console.log(raw);
        const [result, total] = [raw, raw.length];

        return [result, total];
    }

}
