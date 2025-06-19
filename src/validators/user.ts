import { IsIn, IsEmail, IsDefined, IsOptional, IsEnum, IsArray, IsNumber, IsString } from 'class-validator';
import { FilterFriendStatusEnum, FriendActivityStatusEnum } from '../interfaces/requests/friend';

export class LogLiveAgentRules {
    @IsDefined()
    user!: string;
}

export class DeleteLiveAgentRules {
    @IsDefined()
    user!: string;
}

export class SetAvatarUserRules {
    @IsDefined()
    avatar_id!: number;

    @IsDefined()
    username!: string;
}

export class GetAuthFriendListRules {
    @IsOptional()
    @IsEnum(FriendActivityStatusEnum)
    type: string = 'all'

    @IsOptional()
    username?: string

    @IsOptional()
    @IsEnum(FilterFriendStatusEnum)
    friend_status: string = FilterFriendStatusEnum.list
}

export class AuthFriendActionRules {
    @IsDefined()
    @IsArray()
    @IsNumber({allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0}, { each: true })
    user_ids!: number[]
}

export class UserAnalytic {
    @IsDefined()
    start_date!: string;

    @IsDefined()
    end_date!: string;
}

export class BanUnBanUsersRules {
    @IsDefined()
    @IsArray()
    @IsNumber({allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0}, { each: true })
    user_ids!: number[]

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsNumber()
    expired_in?: number;
}