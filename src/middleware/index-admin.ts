import { Handler } from "aws-lambda"
import middy from "middy";
import { httpErrorHandler, doNotWaitForEmptyEventLoop } from "middy/middlewares";

export class AdminMiddlewareWrapper {
    public init(handler: Handler, middlewares: any[]) {
        console.log("Middleware Triggered: ", handler.name);
        try {
            const initialize    = middy(handler)
                                .use(httpErrorHandler())
                                .use(doNotWaitForEmptyEventLoop({ runOnError: true , runOnBefore: true, runOnAfter: true }))
 
            for (const middleware of middlewares) {
                console.log("Middleware Finished: ", handler.name);
                initialize.use(middleware);
            }
            return initialize
        } catch (error) {
            console.log("ERROR", error);
            throw error;
        }
    }
}