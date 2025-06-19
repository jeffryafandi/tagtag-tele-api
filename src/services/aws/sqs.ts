import crypto from "crypto";
import fetch from "node-fetch";
export class SQSService {
    public async sendSQSMessage(queueName: string, accessKeyId: string, secretAccessKey: string, messageBody: string, region = 'ap-southeast-1') {
        const timestamp     = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        let request: any    = {
            path: `/${process.env.AWS_ACCOUNT_ID_ENV}/${queueName}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Host': `sqs.${region}.amazonaws.com`,
                'X-Amz-Date': timestamp
            },
            body: `Action=SendMessage&MessageBody=${encodeURIComponent(messageBody)}`,
        };

        const canonicalRequest  = `${request.method}\n${request.path}\n\ncontent-type:${request.headers['Content-Type']}\nhost:${request.headers['Host']}\nx-amz-date:${timestamp}\n\ncontent-type;host;x-amz-date\n${crypto
            .createHash('sha256')
            .update(request.body)
            .digest('hex')}`;
        
        const stringToSign      = `AWS4-HMAC-SHA256\n${timestamp}\n${timestamp.substring(0, 8)}/${region}/sqs/aws4_request\n${crypto
            .createHash('sha256')
            .update(canonicalRequest)
            .digest('hex')}`;
        
        const dateKey                       = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(timestamp.substring(0, 8)).digest();
        const regionKey                     = crypto.createHmac('sha256', dateKey).update(region).digest();
        const serviceKey                    = crypto.createHmac('sha256', regionKey).update('sqs').digest();
        const signingKey                    = crypto.createHmac('sha256', serviceKey).update('aws4_request').digest();
        // Sign the string to sign
        const signature                     = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
        const authorizationHeader           = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${timestamp.substring(0, 8)}/${region}/sqs/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`;
        request.headers['Authorization']    = authorizationHeader;
        const response                      = await fetch(`https://${request.headers['Host']}/${process.env.AWS_ACCOUNT_ID_ENV}/${queueName}`, request); 
        return await response.text();
    }
}