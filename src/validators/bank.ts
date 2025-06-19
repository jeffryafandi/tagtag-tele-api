import { IsDefined, IsNumber, Min } from "class-validator";

export class CheckBankAccountRules {
    @IsDefined()
    @IsNumber()
    @Min(1)
    bank_id!: number

    @IsDefined()
    account_number!: string
}