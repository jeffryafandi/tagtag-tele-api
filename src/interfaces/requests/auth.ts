export interface LoginWithUsernamePasswordRequest {
  email: string;
  password: string;
}

export interface LoginWithGoogleIdRequest {
  username: string;
  email: string;
  google_id: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface UsernameCheck {
  username: string;
}

export interface ReferrerUsernameCheck {
  username: string;
}

export interface EmailCheck {
  email: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  new_password_confirmation: string;
}

export interface ForgotPasswordChangeRequest {
  new_password: string;
  new_password_confirmation: string;
  reset_password_token: string;
}

export interface AuthChangePinRequest {
  new_pin: string;
  new_pin_confirmation: string;
}

export interface VerifyAddPinRequest {
  request_pin_token: string;
}

export interface AuthForgotPinRequest
  extends AuthChangePinRequest,
    VerifyAddPinRequest {}

export interface LoginWithGopayIdRequest {
  gopay_id: string;
}

export interface LoginWithTelegramRequest {
  tgWebAppData: string;
}
