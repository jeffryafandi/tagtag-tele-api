import { IsBoolean, IsDefined, IsNumber, IsOptional, IsString, Min } from "class-validator";

export type FreeplayFinish = {
    values          : number
    is_watched_ad ?: boolean
    use_extra_life?: boolean
}

export class UpdateUserFreeplayFinishRules {
    @IsDefined()
    @IsNumber()
    @Min(0)
    values!: number;

    @IsOptional()
    @IsBoolean()
    is_watched_ad?: boolean;

    @IsOptional()
    @IsBoolean()
    use_extra_life?: boolean;
}