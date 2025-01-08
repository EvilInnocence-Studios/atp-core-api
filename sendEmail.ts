import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { getAppConfig } from "../../config";

const region = getAppConfig().awsRegion;

export const sendEmail = async (subject: string, body: string, to: string[]) => {
    const client = new SESClient({region });
    const command = new SendEmailCommand({
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
    });

    try {
        await client.send(command);
    } catch(e) {
        console.error(e);
    }
}
