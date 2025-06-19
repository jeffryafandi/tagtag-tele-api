import { Connection, DataSource } from 'typeorm';
import { Users } from "../entities/users";
import { HelperService } from "../services/helper";
import { LoginWithUsernamePasswordResponse } from "../interfaces/responses/auth";
import { 
    LoginWithGoogleIdRequest, 
    LoginWithUsernamePasswordRequest, 
    RegisterRequest,
    ChangePasswordRequest,
    UsernameCheck,
    EmailCheck,
    ReferrerUsernameCheck,
    ForgotPasswordChangeRequest,
    AuthChangePinRequest,
    AuthForgotPinRequest,
    LoginWithGopayIdRequest
} from "../interfaces/requests/auth";
import bcrypt from 'bcrypt';
import strings from '@supercharge/strings';
import { UserService } from './user';
import { LUCKY_WHEEL_SPIN_ENTRIES } from '../config/constants';
import dayjs from 'dayjs';
import { UserPins } from '../entities/user-pins';

export class AuthService {
    public dbConn: Connection;
    public helperService: HelperService;
    public userService: UserService;

    constructor(Connection: Connection|DataSource){
        this.dbConn         = Connection;
        this.helperService  = new HelperService;
        this.userService    = new UserService(this.dbConn);
    }

    public generatePolicy(principalId: string, effect: string, resource: any) {
        let authResponse = {
            principalId     : principalId,
            policyDocument  : {}
        };
        
        if (effect && resource) {
            let policyDocument = {
                Version: '2012-10-17',
                Statement: [
                    {
                        Action  : 'execute-api:Invoke',
                        Effect  : effect,
                        Resource: resource
                    }
                ]
            };

            authResponse.policyDocument = policyDocument;
        }
        
        return authResponse;
    }

    public sanitizeRawToken(rawToken: string): string{
        let token = rawToken.replace("Bearer ", "");
        return token;
    }

    public async generateApiToken(){
        return strings.random(50);
    }

    public async generateLoginKey(){
        return strings.random(15);
    }

    public async generateHashId(){
        let hashId = '';
        for (let index = 0; index < 4; index++) {
            hashId += this.helperService.getRandomInt(9);
        }
        
        return hashId;
    }

    public async isTokenValid(token: string): Promise<Users|null>{
        if (token == undefined || token == '') return null;

        return await this.dbConn.getRepository(Users)
                    .createQueryBuilder('user')
                    .where('api_token = :token', { token })
                    .leftJoinAndSelect('user.bans', 'bans', 'bans.user_id = user.id AND bans.is_expired = 0')
                    .getOne();
    }

    public async validateRegistration(input: RegisterRequest): Promise<number>{
        if(input.password != input.password_confirmation){
            return -1;
        }

        let existingUser = await this.dbConn.getRepository(Users).findOne({
            where: [
                { email: input.email },
                { username: input.username }
            ]
        });

        if(existingUser != null){
            return -2;
        }

        return 1;
    }

    public async CheckReferrerUsername(input: ReferrerUsernameCheck): Promise<number>{
        let existingReferrerUsername    = await this.dbConn.getRepository(Users)
                                        .findOne({where: {username: input.username}});

        if (existingReferrerUsername != null) return -1;

        return 1;
    }

    public async authCheckUsername(input: UsernameCheck): Promise<any>{
        let existingUsername = await this.dbConn.getRepository(Users).findOne({ where: {username: input.username} });
        if (existingUsername) return -1;
        return {
            "is_available": true
        };
    }

    public async authCheckEmail(input: EmailCheck): Promise<any>{
        let existingEmail = await this.dbConn.getRepository(Users).findOne({ where: {email: input.email} });
        if (existingEmail == null) return -1;
        return {
            "is_available": true
        };
    }

    public async validateGoogleIdRegistration(input: LoginWithGoogleIdRequest): Promise<Users|null>{
        return await this.dbConn.getRepository(Users).findOne({ where: {email: input.email} });
    }

    public async validateRegistrationConfirmation(user: Users, confirmOtpToken: string): Promise<number>{
        return (user.confirm_otp_token != confirmOtpToken) ? -1 : 1;
    }

    public async confirmRegistration(user: Users): Promise<{api_token: string; user_id: number}>{
        let apiToken = await this.generateApiToken();
        await this.dbConn.getRepository(Users).update(user.id, {
            "is_confirmed"              : true,
            "api_token"                 : apiToken,
            "lucky_wheel_spin_entries"  : LUCKY_WHEEL_SPIN_ENTRIES
        });

        return {
            user_id   : user.id,
            api_token : apiToken
        };
    }

    public comparePassword(user: Users, password: string): boolean {
        if(!user.password) throw Error("User doesn't have password");
        return bcrypt.compareSync(password, user.password)
    }

    public async loginWithUsernamePassword(input: LoginWithUsernamePasswordRequest): Promise<LoginWithUsernamePasswordResponse>{
        const user  = await this.dbConn.getRepository(Users)
                    .createQueryBuilder('user')
                    .where('email = :email', { email: input.email })
                    .leftJoinAndSelect('user.bans', 'bans', 'bans.user_id = user.id AND bans.is_expired = 0')
                    .getOne();
        let status = 1;
        if (!user) throw Error('User is not found');

        if (user.bans.length) status = -99;

        if (user && !user.password && user.google_id) {
            status = 0;
        };
        if (!bcrypt.compareSync(input.password, user.password)){
            status = -1;
        };
        if (!user.is_confirmed) {
            status = -2;
        };

        const response = {
            status
        }

        if (status == -99) {
            Object.assign(response, {status, user_id: user.id});
        }

        if (status == 1) {
            let apiToken = await this.generateApiToken();
            await this.dbConn.getRepository(Users).update(user.id, {
                "api_token" : apiToken
            });
            Object.assign(response, {
                status,
                user_id     : user.id,
                username    : user.username,
                api_token   : apiToken
            });
        }

        return response;
    }
    
    public async setForgotPasswordToken(user:Users, forgotPasswordToken: string): Promise<number>{
        await this.dbConn.getRepository(Users).update(user.id, {
            "reset_password_token" : forgotPasswordToken
        });

        return 1;
    }
    
    public async requestChangeEmailByUser(user: Users, email: string): Promise<Users | undefined>{
        let totalExistings  = await this.dbConn.getRepository(Users)
                            .createQueryBuilder("users")
                            .where('users.deleted_at IS NULL')
                            .andWhere("users.email = :email", {email: email})
                            .andWhere("users.id != :id", {id: user.id})
                            .getCount();

        if (totalExistings > 0) return;

        let otpToken = this.helperService.generateOTPToken();

        await this.dbConn.getRepository(Users).update(user.id, {
            "change_email_otp_token"    : otpToken
        });

        user.change_email_otp_token = otpToken;

        return user;
    }
    
    public async confirmChangeEmailByUser(user: Users, otpToken: string): Promise<boolean>{
        if (user.change_email_otp_token != otpToken) return false;
        await this.dbConn.getRepository(Users).update(user.id, {
            "email" : user.temp_change_email
        });

        return true;
    }

    public async changeUsername(user: Users, username: string): Promise<boolean>{
        await this.dbConn.getRepository(Users).update(user.id, {
            "username" : username
        });

        return true;
    }
    
    public async changePassword(user: Users, input: ChangePasswordRequest): Promise<number>{
        if((user.password != null && user.password != '') && bcrypt.compareSync(input.old_password, user.password) === false){
            return -1;
        }else if(input.new_password != input.new_password_confirmation){
            return -2;
        }

        await this.dbConn.getRepository(Users).update(user.id, {
            "password" : bcrypt.hashSync(input.new_password, 10)
        });

        return 1;
    }

    public async googleSignin(input: LoginWithGoogleIdRequest): Promise<LoginWithUsernamePasswordResponse>{
        console.log("CALLING googleSignin");
        const user  = await this.dbConn.getRepository(Users)
                    .createQueryBuilder('user')
                    .where('email = :email', { email: input.email })
                    .leftJoinAndSelect('user.bans', 'bans', 'bans.user_id = user.id AND bans.is_expired = 0')
                    .getOne();

        let status = 1;

        if(!user || (user.google_id != input.google_id)){
            status = -1;
        }

        if (user?.bans.length) status = -99;

        let response = {
            status
        }

        if (status == -99) {
            Object.assign(response, {status, user_id: user?.id || 0});
        }

        if (status == 1 && user) {
            let apiToken = await this.generateApiToken();
            await this.dbConn.getRepository(Users).update(user.id, {
                "api_token" : apiToken
            });

            response = Object.assign(response, {
                user_id: user.id,
                status,
                api_token: apiToken
            })
        }

        return response;
    }

    public async logout(user: Users): Promise<Users>{
        user.api_token = '';
        await this.dbConn.getRepository(Users).save(user);
        return user;
    }

    public async getUserFromToken(token: string): Promise<Users|null> {
        return await this.userService.getUserByApiToken(this.sanitizeRawToken(`${token}`));
    }

    public async resetForgotPassword(payload: ForgotPasswordChangeRequest): Promise<void|Error> {
        try {
            const user = await this.userService.getUserByResetPasswordToken(payload.reset_password_token);
            if (!user) throw Error('User is not found!');

            await this.userService.update(user, {
                password            : bcrypt.hashSync(payload.new_password, 10), 
                reset_password_token: ''
            });
        } catch (error) {
            throw error;
        }
    }

    public async setPinToUser(user: Users, payload: AuthChangePinRequest): Promise<string> {
        const userPinService = this.userService.userPinService;
        if (user.user_pin_id) {
            const userPin = await userPinService.fetchUserPinById(user.user_pin_id);
            if (userPin && userPin.is_verified && userPin.user_id == user.id) {
                throw Error('User already have pin. You can make request to change it');
            }
        }
        await userPinService.deleteUserPinsByUserId(user.id);
        const requestPinToken = this.helperService.generateOTPToken();
        await userPinService.storeNewUserPin({
            user_id: user.id,
            pin: payload.new_pin,
            request_pin_token: requestPinToken,
            token_expired_at: dayjs().add(10, 'minute').format('YYYY-MM-DDTHH:mm:ss'),
            is_verified: false
        });

        return requestPinToken;
    }

    public async verifyAuthAddPin(user: Users, pinToken: string) {
        const userPinService = this.userService.userPinService;
        const userPin = await userPinService.findUnverifiedUserPinToken(user, pinToken);
        if (!userPin) throw Error("Invalid OTP code!");

        if (userPin.token_expired_at && dayjs(userPin.token_expired_at) < dayjs()) {
            throw Error('OTP Code is Expired!');
        }

        await userPinService.verifyUserPinById(userPin.id);
        await this.userService.update(user, {user_pin_id: userPin.id});
        return true;
    }

    public async updateAuthRequestToken(user: Users): Promise<string> {
        const userPinService = this.userService.userPinService;
        const userPin = await userPinService.fetchLatestUnverifiedUserPin(user);
        if (!userPin) throw Error("There's no New Pin Request");

        const requestPinToken = this.helperService.generateOTPToken();
        const newPin = await userPinService.updateUserPin(userPin.id, {
            request_pin_token: requestPinToken,
            token_expired_at: dayjs().add(10, 'minute').format('YYYY-MM-DDTHH:mm:ss'),
        });

        return requestPinToken;
    }

    public async authForgotTokenRequest(user: Users): Promise<string> {
        const userPinService        = this.userService.userPinService;
        let userPin: UserPins|null  = null;

        if (user.user_pin_id) {
            userPin = await userPinService.fetchUserPinById(user.user_pin_id);
        }

        if (!userPin) {
            throw Error("No user_pin is found! You can create new one!");
        }

        const requestPinToken = this.helperService.generateOTPToken();
        const newPin = await userPinService.updateUserPin(userPin.id, {
            request_pin_token: requestPinToken,
            token_expired_at: dayjs().add(10, 'minute').format('YYYY-MM-DDTHH:mm:ss'),
        });

        return requestPinToken;
    }

    public async changeAuthPin(userPin: UserPins, pin: string) {
        const userPinService = this.userService.userPinService;
        await userPinService.updateUserPin(userPin.id, { pin });
    }

    public async verifyForgotPinRequest(user: Users, schema: AuthForgotPinRequest): Promise<boolean> {
        const userPinService = this.userService.userPinService;
        const userPins = await userPinService.fetchVerifiedUserPins(user);
        if (userPins.length == 0) throw Error('User doesn\'t have pin');
        const pinToken = Buffer.from(schema.request_pin_token, 'base64').toString('ascii');
        const filtered = userPins.filter((userPin) => userPin.request_pin_token == pinToken);
        
        if (filtered.length < 1) throw Error('Verification link is invalid!');

        const userPin = userPins[0];
        if (userPin.token_expired_at && dayjs(userPin.token_expired_at) < dayjs()) {
            throw Error('Verification link is expired!')
        }
        await userPinService.updateUserPin(userPin.id, { pin: schema.new_pin });
        await userPinService.verifyUserPinById(userPin.id);
        await this.userService.update(user, {user_pin_id: userPin.id});

        return true;
    }

    public async checkIsPinAuthenticated(user: Users, pin: string): Promise<{is_valid: boolean, userPin?: UserPins}> {
        const userPinService = this.userService.userPinService;
        if (!user.user_pin_id) {
            throw Error("User doesn't have pin");
        }

        const userPin = await userPinService.fetchUserPinById(user.user_pin_id);
        if (!userPin || !userPin.is_verified || userPin.user_id !== user.id) {
            throw Error("User doesn't have verified pin");
        }

        return {
            is_valid: userPin.pin == pin,
            userPin
        };
    }

    public async validateGopayIdRegistration(input: LoginWithGopayIdRequest): Promise<Users|null>{
        return await this.dbConn.getRepository(Users).findOne({ where: {gopay_id: input.gopay_id} });
    }

    public async gopaySignin(gopay_id: string): Promise<LoginWithUsernamePasswordResponse>{
        console.log("CALLING gopaySignin");
        const user  = await this.dbConn.getRepository(Users)
                    .createQueryBuilder('user')
                    .where('gopay_id = :gopay_id', { gopay_id: gopay_id })
                    .leftJoinAndSelect('user.bans', 'bans', 'bans.user_id = user.id AND bans.is_expired = 0')
                    .getOne();

        let status = 1;

        if(!user || (user.gopay_id != gopay_id)){
            status = -1;
        }

        if (user?.bans.length) status = -99;

        let response = {
            status
        }

        if (status == -99) {
            Object.assign(response, {status, user_id: user?.id || 0});
        }

        if (status == 1 && user) {
            let apiToken = await this.generateApiToken();
            await this.dbConn.getRepository(Users).update(user.id, {
                "api_token" : apiToken
            });

            response = Object.assign(response, {
                user_id: user.id,
                status,
                api_token: apiToken
            })
        }

        return response;
    }
}