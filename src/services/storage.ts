import { Connection, DeleteResult, InsertResult, UpdateResult, Brackets, getManager } from 'typeorm';
import { UploadResponse } from "../interfaces/responses/storage";
import { LambdaService } from './aws/lambda';
// import * as AWS from "aws-sdk";
export class StorageService {
    public dbConn: Connection;
    public bucket: string | undefined;
    protected lambdaService: LambdaService;

    constructor(Connection: Connection){
        this.dbConn         = Connection;
        this.bucket         = process.env.AWS_BUCKET_ENV;
        this.lambdaService  = new LambdaService();
    }

    public async upload(fileName:string, source: string): Promise<UploadResponse> {
        const functionName      = `${process.env.LAMBDA_UPLOAD_FUNCTION}`;
        const accessKeyId       = `${process.env.AWS_ACCESS_KEY_ID_ENV}`;
        const secretAccessKey   = `${process.env.AWS_SECRET_ACCESS_KEY_ENV}`;
        const awsRegion         = `${process.env.AWS_REGION_ENV}`;
        try {
            const response          = await this.lambdaService.invokeLambda(functionName, { body: JSON.stringify({image: source, name: fileName})}, accessKeyId, secretAccessKey, awsRegion);
            const data              = JSON.parse(response.body);
            return {
                file_url: data.data.file_url
            }
        } catch (error) {
            throw Error("Upload file failed!");
        }
    }
}