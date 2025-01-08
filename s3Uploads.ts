import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { error500 } from "./express/util";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAppConfig } from "../../config";

export declare interface IUploadOptions {
    failOnExist?: boolean;
}

const Bucket = getAppConfig().mediaBucket;
const region = getAppConfig().awsRegion;

export const uploadMedia = async (urlBase:string, file: Express.Multer.File, options?:IUploadOptions) => {
    const { originalname, buffer } = file;

    const client = new S3Client({ region });
    const key = `${urlBase}/${originalname}`;

    // Determine if file already exists
    if(options?.failOnExist) {
        const command = new HeadObjectCommand({ Bucket, Key: key });
        try {
            await client.send(command);
            throw new Error("File already exists");
        } catch(e:any) {
            if(e.name !== "NotFound") {
                throw e;
            }
        }
    }

    // Upload file to S3
    const command = new PutObjectCommand({
        Bucket,
        Key: key,
        Body: buffer,
        ACL: "public-read",
    });
    await client.send(command);
}

export const removeMedia = async (urlBase:string, name:string) => {
    const client = new S3Client({ region });
    const key = `${urlBase}/${name}`;
    const command = new DeleteObjectCommand({ Bucket, Key: key });
    const response = await client.send(command);

    // If the removal of the file failed, skip the db record removal
    if (response.$metadata.httpStatusCode !== 204) {
        throw error500("Failed to remove file from the media store");
    }
    
}

export const downloadMedia = async (urlBase:string, name:string) => {
    const client = new S3Client({ region });
    const key = `${urlBase}/${name}`;
    const command = new GetObjectCommand({ Bucket, Key: key });
    return await getSignedUrl(client, command, {expiresIn: 3600});
}