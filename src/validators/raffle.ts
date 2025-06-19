import { IsDefined, IsEnum, IsNumber, IsString, Min } from "class-validator";

export class SubmitToRafffleRules {
    @IsDefined()
    @IsNumber()
    @Min(1)
    coupons!: number
}