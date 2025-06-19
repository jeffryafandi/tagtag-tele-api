import { IsDefined, IsEnum, IsNumber, IsString, Min } from "class-validator";

export class SubmitHighscoreRules {
    @IsDefined()
    @IsNumber()
    @Min(1)
    values!: number
}