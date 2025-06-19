import { Handler } from "aws-lambda"
import middy from "middy";
import { httpErrorHandler, doNotWaitForEmptyEventLoop } from "middy/middlewares";
import { checkAppMaintenance } from "./check-app-maintenance";

export class MiddlewareWrapper {
    public init(handler: Handler, middlewares: any[]) {
        try {
            const initialize    = middy(handler)
                                .use(httpErrorHandler())
                                .use(doNotWaitForEmptyEventLoop({ runOnError: true , runOnBefore: true, runOnAfter: true }))
                                .use(checkAppMaintenance())
 
            for (const middleware of middlewares) {
                initialize.use(middleware);
            }
            return initialize
        } catch (error) {
            console.log("ERROR", error);
            throw error;
        }
    }
}