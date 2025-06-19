import Pusher from "pusher";


export class PusherService {
    protected client: Pusher;

    constructor() {
        const appKey    = `${process.env.PUSHER_APP_KEY}`;
        const appHost   = `${process.env.PUSHER_HOST}`;
        const appPort   = `${process.env.PUSHER_PORT}`;
        const appSecret = `${process.env.PUSHER_APP_SECRET}`;
        const appId     = `${process.env.PUSHER_APP_ID}`;
        this.client = new Pusher({
            key: appKey,
            host: appHost,
            port: appPort,
            useTLS: false,
            secret: appSecret,
            appId: appId,
        })
    }

    /**
     * publish to channel
     * @param channelName the destination channel
     * @param eventName the name of the emitted event
     * @param data data the data you want to send
     */
    public async publish(channelName: string, eventName: string, data: Record<any, any>) {
        return await this.client.trigger(channelName, eventName, data)
    }
}