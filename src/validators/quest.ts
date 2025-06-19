import { IsArray, IsBoolean, IsDefined, IsNumber, IsOptional, IsString, Min } from "class-validator";

export type QuestProgress = {
    game_inventory_codes: string[],
    reward_multiplier   : number,
    values              : number,
    use_extra_life      ?: boolean
}

export class UpdateUserQuestProgressRules {
    @IsDefined()
    @IsNumber()
    @Min(0)
    values!: number;

    @IsDefined()
    @IsNumber()
    @Min(1)
    reward_multiplier!: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    game_inventory_codes!: string[];

    @IsOptional()
    @IsBoolean()
    use_extra_life?: boolean;
}