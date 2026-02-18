import {
    CreateFunctionCommand,
    CreateFunctionCommandInput,
    LambdaClient,
    Runtime,
    UpdateFunctionCodeCommand,
    UpdateFunctionConfigurationCommand,
    waitUntilFunctionUpdated,
    CreateFunctionUrlConfigCommand,
    UpdateFunctionUrlConfigCommand,
    FunctionUrlAuthType
} from '@aws-sdk/client-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { loadEnv } from './loadEnv';
import { fromEnv } from '@aws-sdk/credential-providers';

const lambda = new LambdaClient({ region: 'us-east-1', credentials: fromEnv()});
const s3 = new S3Client({ region: 'us-east-1', credentials: fromEnv()});

export const uploadToLambda = async (
    zipFilePath: string,
    FunctionName: string,
    accountId: string,
    roleName: string,
    envFilePath: string,
    S3Bucket: string,
    S3Key: string,
): Promise<string | undefined> => {
    const ZipFile = fs.readFileSync(zipFilePath);

    // Upload the zip file to S3
    try {
        console.log("Uploading zip file to S3");
        await s3.send(new PutObjectCommand({
            Bucket: S3Bucket,
            Key: S3Key,
            Body: ZipFile
        }));
        console.log(`Zip file uploaded to S3 bucket ${S3Bucket} with key ${S3Key}.`);
    } catch (s3Error:any) {
        console.error(`Error uploading zip file to S3: ${s3Error.message}`);
        return;
    }

    const params = {
        FunctionName,
        S3Bucket,
        S3Key,
    };

    // Update the Lambda function code, creating it if necessary
    try {
        console.log("Updating Lambda function code from S3");
        await lambda.send(new UpdateFunctionCodeCommand(params));
        console.log(`Lambda function ${FunctionName} updated successfully.`);
    } catch (error:any) {
        if (error.name === 'ResourceNotFoundException') {
            try {
                const createParams:CreateFunctionCommandInput = {
                    FunctionName,
                    Role: `arn:aws:iam::${accountId}:role/${roleName}`,
                    Handler: 'index.handler',
                    Runtime: Runtime.nodejs22x,
                    Code: { S3Bucket, S3Key },
                    Timeout: 30, // Set timeout to 30 seconds
                };

                await lambda.send(new CreateFunctionCommand(createParams));
                console.log(`Lambda function ${FunctionName} created successfully.`);
            } catch (createError:any) {
                console.error(`Error creating Lambda function: ${createError.message}`);
            }
        } else {
            console.error(`Error updating Lambda function: ${error.message}`);
        }
    }

    await waitUntilFunctionUpdated({
        client: lambda,
        maxWaitTime: 30,
    }, { FunctionName });

    // Create or update the Lambda function URL
    const functionUrlParams = {
        FunctionName,
        AuthType: FunctionUrlAuthType.NONE,
        Cors: {
            AllowOrigins: ['*'],
            AllowMethods: ['*'],
            AllowHeaders: ['*'],
            AllowCredentials: true,
            ExposeHeaders: ['*'],
            MaxAge: 86400
        }
    };

    try {
        console.log("Creating or updating Lambda function URL");
        await lambda.send(new CreateFunctionUrlConfigCommand(functionUrlParams));
        console.log(`Lambda function URL for ${FunctionName} created successfully.`);
    } catch (urlError: any) {
        if (urlError.name === 'ResourceConflictException') {
            try {
                await lambda.send(new UpdateFunctionUrlConfigCommand(functionUrlParams));
                console.log(`Lambda function URL for ${FunctionName} updated successfully.`);
            } catch (updateUrlError: any) {
                console.error(`Error updating Lambda function URL: ${updateUrlError.message}`);
            }
        } else {
            console.error(`Error creating Lambda function URL: ${urlError.message}`);
        }
    }

    // Update the environment variables for the Lambda function
    if (fs.existsSync(envFilePath)) {
        const updateEnvParams = {
            FunctionName,
            Environment: {
                Variables: loadEnv(envFilePath),
            },
            Timeout: 30, // Set timeout to 30 seconds
        };

        try {
            await lambda.send(new UpdateFunctionConfigurationCommand(updateEnvParams));
            console.log(`Environment variables for Lambda function ${FunctionName} updated successfully.`);
        } catch (envError:any) {
            console.error(`Error updating environment variables for Lambda function: ${envError.message}`);
        }
    } else {
    }

    try {
        console.log("Fetching Lambda function URL...");
        const { GetFunctionUrlConfigCommand } = await import('@aws-sdk/client-lambda');
        const urlConfig = await lambda.send(new GetFunctionUrlConfigCommand({ FunctionName }));
        if (urlConfig.FunctionUrl) {
            console.log(`LAMBDA_URL=${urlConfig.FunctionUrl}`);
            return urlConfig.FunctionUrl;
        }
    } catch (err: any) {
        console.error(`Error fetching Lambda function URL: ${err.message}`);
    }
    return undefined;
}
