import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fromEnv } from "@aws-sdk/credential-providers";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Setting } from "../common/setting/service";
import { error500 } from "./express/errors";

export declare interface IUploadOptions {
    failOnExist?: boolean;
    skipExisting?: boolean;
    acl?: ObjectCannedACL;
}

export declare interface IFile {
    name: string;
    data: Buffer;
    size: number;
    encoding: string;
    tempFilePath: string;
    truncated: boolean;
    mimetype: string;
    md5: string;
    mv: (path:string) => Promise<void>;
}

const getRegion = () => Setting.get("awsRegion");
const getBucket = () => Setting.get("mediaBucket");

export const getPresignedUploadUrl = async (Key:string, acl:ObjectCannedACL = "public-read") => {
    const region = await getRegion();
    const Bucket = await getBucket();
    const client = new S3Client({ region, credentials: fromEnv() });
    const command = new PutObjectCommand({
        Bucket,
        Key,
        ACL: acl,
    });

    return getSignedUrl(client, command, { expiresIn: 3600 });
}

export const uploadMedia = async (urlBase:string, file: any, options?:IUploadOptions) => {
    const region = await getRegion();
    const Bucket = await getBucket();
    const client = new S3Client({ region, credentials: fromEnv() });
    const key = `${urlBase}/${file.name}`;

    if (!(file.data instanceof Buffer)) {
        throw new Error("uploadMedia: file.data must be a Buffer");
    }

    // Determine if file already exists
    if(options?.failOnExist || options?.skipExisting) {
        const command = new HeadObjectCommand({ Bucket, Key: key });
        try {
            const result = await client.send(command);
            // console.log(result);

            if(options?.skipExisting) {
                console.log(`File already exists, skipping upload: ${key}`);
                return;
            }

            throw new Error("File already exists");
        } catch(e:any) {
            if(e.name !== "NotFound") {
                throw e;
            }
        }
    }

    // Upload file to S3
    console.log(`Uploading file to S3: ${key}`);
    const command = new PutObjectCommand({
        Bucket,
        Key: key,
        Body: file.data,
        ACL: options?.acl || "public-read",
        ContentType: file.mimetype,
    });
    await client.send(command);
    console.log(`File uploaded successfully: ${key}`);
}

export const removeMedia = async (urlBase:string, name:string) => {
    const region = await getRegion();
    const Bucket = await getBucket();
    const client = new S3Client({ region, credentials: fromEnv()});
    const key = `${urlBase}/${name}`;
    const command = new DeleteObjectCommand({ Bucket, Key: key });
    const response = await client.send(command);

    // If the removal of the file failed, skip the db record removal
    if (response.$metadata.httpStatusCode !== 204) {
        throw error500("Failed to remove file from the media store");
    }
    
}

export const downloadMedia = async (urlBase:string, name:string) => {
    const region = await getRegion();
    const Bucket = await getBucket();
    const client = new S3Client({ region, credentials: fromEnv()});
    const key = `${urlBase}/${name}`;
    const command = new GetObjectCommand({ Bucket, Key: key });
    return await getSignedUrl(client, command, {expiresIn: 3600});
}