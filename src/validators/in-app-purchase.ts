import { isDefined, IsDefined, IsEnum, IsString, ValidateIf } from "class-validator";

export class AppPurchaseRules {
    @IsDefined()
    @IsString()
    ext_product_id!: string;

    @ValidateIf(o => o.status === 'PURCHASED')
    @IsDefined()
    @IsString()
    ext_token!: string;

    @IsDefined()
    @IsString()
    status!: string;

    @ValidateIf(o => o.status === 'PURCHASED')
    @IsDefined()
    @IsString()
    iap_trx_id!: string;
}

export class UpdatePurchasesRules {
    @IsDefined()
    @IsString()
    status!: string;
}

export class CreatePaymentRules {
    @IsDefined()
    @IsString()
    ext_product_id!: string;
}