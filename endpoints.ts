// ./src/endpoints.ts

import { RequestHandler } from "express";

// Recursive type for the API config
export type IApiConfig = {
    [route: string]: RequestHandler | IApiConfig;
};