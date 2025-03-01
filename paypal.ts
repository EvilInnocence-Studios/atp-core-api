import { Client, Environment, LogLevel } from "@paypal/paypal-server-sdk";
import request from 'superagent';

const {
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
    PORT = 8080,
} = process.env;

export const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: PAYPAL_CLIENT_ID as string,
        oAuthClientSecret: PAYPAL_CLIENT_SECRET as string,
    },
    timeout: 0,
    environment: process.env.env === "local" ? Environment.Sandbox : Environment.Production,
    logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
    },
}); 

const apiBase = 'https://api-m.paypal.com/v1/';

const getAccessToken = () => 
    request.post(`${apiBase}oauth2/token`)
        .set('Authorization', `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({ grant_type: 'client_credentials' })
        .then(response => response.body.access_token);

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