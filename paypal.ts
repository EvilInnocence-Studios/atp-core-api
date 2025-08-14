import { Setting } from "../common/setting/service";
import { Client, Environment, LogLevel } from "@paypal/paypal-server-sdk";
import request from 'superagent';

export const getPayPalClient = async () => new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: await Setting.get("paypalClientId"),
        oAuthClientSecret: await Setting.get("paypalClientSecret"),
    },
    timeout: 0,
    environment: Environment.Production,
    logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
    },
}); 

const apiBase = 'https://api-m.paypal.com/v1/';

const getAccessToken = async () => {
    const clientId = await Setting.get("paypalClientId");
    const clientSecret = await Setting.get("paypalClientSecret");
    return request.post(`${apiBase}oauth2/token`)
        .set('Authorization', `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({ grant_type: 'client_credentials' })
        .then(response => response.body.access_token);
}

export const subscription = {
    cancel: async (subscriptionId: string) => {
        const url = `${apiBase}billing/subscriptions/${subscriptionId}/cancel`;
        const token = await getAccessToken();
        console.log('PayPal Token', token);
        return request.post(url)
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/json')
            .send({ reason: "Customer requested to cancel" });
    }
}