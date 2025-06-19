import { IsIn, IsEmail, IsDefined } from 'class-validator';

export class CreateLuckyWheel {
    @IsDefined()
    name!: string;
}

export class UpdateLuckyWheel {
    @IsDefined()
    name?     : string;
    is_active?: boolean;
}
