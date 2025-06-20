import {
  IsIn,
  IsEmail,
  IsDefined,
  IsOptional,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
  registerDecorator,
  ValidationOptions,
  isString,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNumber,
  Min,
  IsEnum,
  IsMimeType,
} from "class-validator";
import { MIN_INQUIRY_AMOUNT } from "../config/constants";
import {
  AvailableWithdrawCurrency,
  UserVerificationStatusEnum,
} from "../interfaces/requests/users";
import { TransactionAvailableCodeEnum } from "../interfaces/requests/transaction";
@ValidatorConstraint({ name: "isYear", async: false })
export class IsYear implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    const year = Number(text);
    return isNaN(year) || `${year}`.length !== 4 || year < 1970 ? false : true;
  }

  defaultMessage(args: ValidationArguments) {
    // here you can provide default error message if validation failed
    return "Year ($value) is not a valid year!";
  }
}
export class RegisterRules {
  @IsDefined()
  @IsEmail()
  email!: string;

  @IsDefined()
  password!: string;

  @IsDefined()
  password_confirmation!: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: "username cannot use special characters!",
  })
  username!: string;
}

export class UsernameCheck {
  @IsDefined()
  username!: string;
}

export class EmailCheck {
  @IsDefined()
  email!: string;
}

export class ResendRegistrationOtpRules {
  @IsDefined()
  email!: string;

  @IsDefined()
  password!: string;
}

export class ConfirmRegistrationRules {
  @IsDefined()
  email!: string;

  @IsDefined()
  confirm_otp_token!: string;
}

export class LoginWithUsernameAndPasswordRules {
  @IsDefined()
  email!: string;

  @IsDefined()
  password!: string;
}

export class LoginWithGoogleIdRules {
  @IsDefined()
  @IsEmail()
  email!: string;

  @IsOptional()
  username!: string;

  @IsDefined()
  google_id!: string;
}

export class ForgotPasswordRules {
  @IsDefined()
  email!: string;
}

export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
}

export function NoMatch(
  property: string,
  validationOptions?: ValidationOptions
) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: NoMatchConstraint,
    });
  };
}

@ValidatorConstraint({ name: "shouldSame", async: false })
export class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    return value === relatedValue;
  }

  defaultMessage(args: ValidationArguments) {
    const prop = args.property;
    const compare = args.constraints[0];
    return `The value of '${prop}' is not match the '${compare}'`;
  }
}

@ValidatorConstraint({ name: "shouldSame", async: false })
export class NoMatchConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    return value !== relatedValue;
  }

  defaultMessage(args: ValidationArguments) {
    const prop = args.property;
    const compare = args.constraints[0];
    return `The value of '${prop}' should be not same with the '${compare}'`;
  }
}

export class ForgotPasswordConfirmRules {
  @IsDefined()
  new_password!: string;

  @IsDefined()
  @Match("new_password")
  new_password_confirmation!: string;

  @IsDefined()
  reset_password_token!: string;
}

export class CheckForgotPasswordTokenRules {
  @IsDefined()
  email!: string;

  @IsDefined()
  forgot_password_token!: string;
}

export class ResetPasswordRules {
  @IsDefined()
  old_password!: string;

  @IsDefined()
  new_password!: string;

  @IsDefined()
  new_password_confirmation!: string;

  @IsDefined()
  reset_password_token!: string;
}

export class ChangeEmailOTPRules {
  @IsDefined()
  email!: string;
}

export class ChangeEmailRules {
  @IsDefined()
  otp_token!: string;
}

export class ChangePasswordRules {
  @IsDefined()
  old_password!: string;

  @IsDefined()
  new_password!: string;

  @IsDefined()
  new_password_confirmation!: string;
}

export class ChangeAddressRules {
  @IsDefined()
  address!: string;

  @IsDefined()
  notes!: string;

  @IsDefined()
  recipient_name!: string;

  @IsDefined()
  phone_number!: string;
}

export class AddAuthAffiliateRules {
  @IsDefined()
  type!: string;
  name!: string;
  description!: string;
  link!: string;
  pic!: string;
  phone_number!: string;
  email!: string;
  affiliate_benefit_id!: number;
}

export class UserWithdrawRules {
  @IsDefined()
  @IsString()
  @IsEnum(AvailableWithdrawCurrency, {
    message: "currency must be one of the following values: `coin`, `revenue`",
  })
  currency!: string;

  @IsDefined()
  @IsNumber()
  @Min(MIN_INQUIRY_AMOUNT)
  amount!: number;

  @IsDefined()
  user_bank_id!: number;

  @IsDefined()
  @IsString()
  pin!: string;
}

export class AuthWithdrawEWalletRules {
  @IsDefined()
  @IsString()
  @IsEnum(AvailableWithdrawCurrency, {
    message: "currency must be one of the following values: `coin`, `revenue`",
  })
  currency!: string;

  @IsDefined()
  @IsString()
  account_number!: string;

  @IsDefined()
  @IsNumber()
  @Min(1)
  operator_id!: number;

  @IsDefined()
  @IsString()
  pin!: string;
}

export class AuthCommissionQuery {
  @IsOptional()
  @IsString()
  @Validate(IsYear)
  year?: string;
}

export class CreateUserBankRules {
  @IsDefined()
  @IsNumber()
  @Min(1)
  bank_id!: number;

  @IsDefined()
  account_number!: string;
}

export class UserClaimRules {
  @IsDefined()
  msisdn!: string;
}

export function IsBase64Image(validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsBase64ImageConstraint,
    });
  };
}

@ValidatorConstraint({ name: "shouldSame", async: false })
export class IsBase64ImageConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    if (!value) return false;
    if (value.split(";").length <= 0) return false;

    const imageType = value.split(";")[0];
    if (!imageType || imageType.split("/").length <= 0) return false;

    const checkType = imageType.split("/")[1];
    if (!checkType) return false;

    if (!["png", "jpg", "jpeg"].includes(checkType)) return false;

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const prop = args.property;
    return `The value of '${prop}' is not a valid base64 image`;
  }
}
export class StoreVerificationRules {
  @IsDefined()
  @IsBase64Image()
  image!: string;
}

export class UpdateVerificationStatusRules {
  @IsDefined()
  @IsEnum(UserVerificationStatusEnum, {
    message: "status should be between `pending`, `rejected`, or `verified`",
  })
  status!: string;
}

export class UpdateUser {
  @IsOptional()
  add_coins?: number;
  add_coupons?: number;
  add_activity_point?: number;
}

export class AuthTransactionParamsRules {
  @IsOptional()
  @IsEnum(TransactionAvailableCodeEnum, { message: "invalide code" })
  code!: string;
}

export class CreatedAt {
  @IsDefined()
  created_at?: string;
}

export class AuthAddPinRules {
  @IsDefined()
  @IsString()
  @MinLength(6)
  new_pin!: string;

  @IsDefined()
  @IsString()
  @MinLength(6)
  @Match("new_pin")
  new_pin_confirmation!: string;
}

export class VerifyAddPinRules {
  @IsDefined()
  @IsString()
  request_pin_token!: string;
}

export class ForgotPinRules extends AuthAddPinRules {
  @IsDefined()
  @IsString()
  request_pin_token!: string;
}

export class ChangePinRules extends AuthAddPinRules {
  @IsDefined()
  @IsString()
  @NoMatch("new_pin")
  old_pin!: string;
}

export class CheckPinRules {
  @IsDefined()
  @IsString()
  @MinLength(6)
  pin!: string;

  @IsDefined()
  @IsString()
  @MinLength(6)
  @Match("pin")
  pin_confirmation!: string;
}

export class CheckUsernameRules {
  @IsDefined()
  @IsString()
  @MinLength(6)
  username!: string;
}

export class AccountValidationGopayRules {
  @IsDefined()
  @MinLength(1)
  phone!: string;
}

export class SummaryGopayRules {
  @IsDefined()
  phone!: string;

  @IsDefined()
  amount!: string;
}

export class UserWithdrawGopayRules {
  @IsDefined()
  phone!: string;

  @IsDefined()
  amount!: string;
}

export class LoginWithGopayIdRules {
  @IsDefined()
  auth_code!: string;
}

export class LoginWithTelegramRules {
  @IsDefined()
  tgWebAppData!: string;
}

export class SummaryGopayIdRules {
  @IsDefined()
  amount!: string;
}

export class UserWithdrawGopayIdRules {
  @IsDefined()
  amount!: string;
}
