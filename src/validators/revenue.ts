import { IsDate, IsDefined, IsEnum, IsNumber, IsString, Min, Validate } from "class-validator";
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'customIsDateString', async: false })
export class CustomIsDateValidator implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments): boolean {
    const splitted = text.split('-'); 
    if (splitted.length < 3) return false;
    if (splitted[0].length < 4 || splitted[1].length < 2) return false;
    
    const insertedDate = new Date(text);
    
    if (insertedDate.toString() === 'Invalid Date') return false;
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'The ($value) should be under valid format yyyy-mm-dd!';
  }
}
export class InitRevenueBaselineRules {
    @IsDefined()
    @IsNumber()
    cpm!: number;
    
    @IsDefined()
    @IsNumber()
    prize_pool_rate!: number;
    
    @IsDefined()
    @IsNumber()
    platform_rate!: number;

    @IsDefined()
    @Validate(CustomIsDateValidator)
    start_date!: string;

    @IsDefined()
    @Validate(CustomIsDateValidator)
    end_date!: string;
}