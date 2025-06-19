import { Lambda } from "aws-sdk";
import crypto from "crypto";

export class LambdaService {
    protected lambda?: Lambda;

    constructor()
    {
        this.lambda = new Lambda({
            region: process.env.AWS_REGION_ENV || 'ap-southeast-1',
            // endpoint: "https://ap-southeast-1.console.aws.amazon.com"
            endpoint: process.env.AWS_LAMBDA_ENDPOINT || 'http://localhost:3031'
        });
    }

    public async invokeLambda(functionName: string, payload: object, accessKeyId: string, secretAccessKey: string, region = 'us-east-1') {
        // const endpoint = `https://lambda.${region}.amazonaws.com/2015-03-31/functions/${functionName}/invocations`;
        const endpoint              = `https://lambda.ap-southeast-1.amazonaws.com/2015-03-31/functions/${functionName}/invocations`;
        const host                  = new URL(endpoint).host;
        const amzDate               = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
        const dateStamp             = amzDate.slice(0, 8);

        const canonicalHeaders      = `host:${host}\nx-amz-date:${amzDate}\n`;
        const signedHeaders         = 'host;x-amz-date';
        const payloadHash           = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        const canonicalRequest      = `POST\n/2015-03-31/functions/${functionName}/invocations\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
        const algorithm             = 'AWS4-HMAC-SHA256';
        const credentialScope       = `${dateStamp}/${region}/lambda/aws4_request`;
        const stringToSign          = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

        const signingKey            = this.getSignatureKey(secretAccessKey, dateStamp, region, 'lambda');
        const signature             = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
        const authorizationHeader   = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
        try {
            const response              = await fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'x-amz-date': amzDate,
                    'Authorization': authorizationHeader,
                    'Content-Type': 'application/json',
                    'X-Amz-Invocation-Type': 'RequestResponse'
                }
            });
        
            const text = await response.text();
            return JSON.parse(text);
        } catch (error) {
            throw Error(`Failed invoking lambda function with name: ${functionName}`);
        }
    }
    
    public getSignatureKey (key: string, dateStamp: string, regionName: string, serviceName: string) {
        const kDate = crypto.createHmac('sha256', "AWS4" + key).update(dateStamp).digest();
        const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
        const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
        const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
        return kSigning;
    }
}