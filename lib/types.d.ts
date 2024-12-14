import request from "superagent";
import { Index } from "ts-functional/dist/types";

export declare type IApiConfig = {
    baseUrl: string;
};

export type RequestFunc = (url: string, bodyOrQuery: Record<string, any>) => request.Request;
export type RequestGenerator = (method: string, apiConfig:IApiConfig) => RequestFunc;

export declare interface IMethods  {
    get: RequestFunc;
    post: RequestFunc;
    put: RequestFunc;
    patch: RequestFunc;
    remove: RequestFunc;
}

export declare type Params = Index<string>;
export declare type Paging = {offset:number, perPage:number};
export declare type Query = Paging & Index<string | string[]>;

