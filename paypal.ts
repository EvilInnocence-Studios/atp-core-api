import { Setting } from "../common/setting/service";
import { ApiError, CheckoutPaymentIntent, Client, Environment, LogLevel, OrdersController } from "@paypal/paypal-server-sdk";
import { string } from "@paypal/paypal-server-sdk/dist/types/schema";
import request from 'superagent';
import { error500 } from "./express/errors";

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

export declare interface IPayPalCartItem {
    id: string;
    name: string;
    quantity: number;
    unit_amount: {
        currency_code: string;
        value: string;
    };
}
export declare type PayPalCartGenerator = () => Promise<IPayPalCartItem[]>;

const getOrdersController = async () => new OrdersController(await getPayPalClient());

export const createOrder = async (createCart:PayPalCartGenerator, total: number) => {
    const collect = {
        body: {
            intent: CheckoutPaymentIntent.Capture,
            cart: await createCart(),
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: "USD",
                        value: total.toString(),
                    },
                },
            ],
        },
        prefer: "return=minimal",
    }; 

    try {
        const controller = await getOrdersController();
        const { body, ...httpResponse } = await controller.ordersCreate(
            collect
        );
        // Get more response info...
        // const { statusCode, headers } = httpResponse;
        return {
            jsonResponse: JSON.parse(body as string),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        console.log(error);
        if (error instanceof ApiError) {
            // const { statusCode, headers } = error;
            throw new Error(error.message);
        }
    }
};

export const captureOrder = async (transactionId: string) => {
    const collect = {
        id: transactionId,
        prefer: "return=minimal",
    };

    try {
        const controller = await getOrdersController();
        const { body, ...httpResponse } = await controller.ordersCapture(
            collect
        );
        // Get more response info...
        // const { statusCode, headers } = httpResponse;
        return {
            jsonResponse: JSON.parse(body as string),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            // const { statusCode, headers } = error;
            throw error500(error.message);
        }
    }
};
