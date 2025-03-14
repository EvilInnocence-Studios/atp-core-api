import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { getAppConfig } from "../../config";
import { fromEnv } from "@aws-sdk/credential-providers";

const region = getAppConfig().awsRegion;

export const sendEmail = async (subject: string, body: string, to: string[]) => {
    const client = new SESClient({region, credentials: fromEnv() });
    const params = {
        Destination: {
            ToAddresses: to
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: body
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: subject,
            }
        },
        Source: getAppConfig().supportEmail,
    };
    console.log(params);
    const command = new SendEmailCommand(params);

    try {
        const response = await client.send(command);
        console.log(response);
    } catch(e) {
        console.log(e);
        console.error(e);
    }
}
