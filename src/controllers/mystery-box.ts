import * as lambda from 'aws-lambda';
import { MiddlewareWrapper } from '../middleware';
import { checkBannedMiddleware } from '../middleware/check-ban-middleware';
import { ResponseService } from '../services/response';
import { Database } from '../database';
import { MysteryBoxService } from '../services/mystery-box';
import { AuthService } from '../services/auth';

const init = async () => {
    const connection        = await new Database().getConnection();
    const mysteryBoxService = new MysteryBoxService(connection);
    const authService       = new AuthService(connection);

    return {connection, mysteryBoxService, authService};
}

export const userClaimMysteryBox: lambda.Handler = async (event: lambda.APIGatewayEvent) => {
    try {
        const {
            mysteryBoxService,
            authService
        } = await init();

        const user  = await authService.getUserFromToken(`${event.headers.Authorization}`);
        if (!user) throw Error('User is not found!');

        console.log("HEHE", user);
        const claim = await mysteryBoxService.claimBox(user);
        return ResponseService.baseResponseJson(claim.is_claimed ? 200 : 422, claim.is_claimed ? 'Claim MysteryBox Succesfully' : 'Claim MysteryBox is failed', claim);
    } catch (error: any) {
        console.log(error);
        return ResponseService.baseResponseJson(422, 'Something Error', {error: error?.message ? error.message : JSON.stringify(error)})
    }
}

// exports.userClaimMysteryBox    = new MiddlewareWrapper().init(userClaimMysteryBox, [checkBannedMiddleware()]);
