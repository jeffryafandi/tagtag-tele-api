import { IsDefined, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import { Match } from "./auth";

export class OperatorCheckBillingRules {
    @IsDefined()
    @IsNumber({allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0}, { each: true })
    @Min(1)
    operator_id!: number;

    @IsDefined()
    @IsNotEmpty()
    @IsString()
    account_number!: string;    
}

export class UserPayOperatorBillRules extends OperatorCheckBillingRules {
    @IsDefined()
    @IsString()
    pin !: string;
}