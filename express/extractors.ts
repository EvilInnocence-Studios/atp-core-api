import jwt from "jsonwebtoken";
import { at, defaultValue, memoizePromise, merge, pipe, pipeTo, prop, split } from "ts-functional";
import { secret } from "../../../config";
import { Params, Query } from "../../core-shared/express/types";
import { User } from "../../uac/user/service";

export const getParams       = (args:any[]):Params => args[0] as Params;
export const getParam        = <T>(name:string) => (args:any[]) => getParams(args)[name] as T;
export const getParamInObj   = <T>(name:string) => (args:any[]) => ({[name]: getParams(args)[name] as T});

export const getBody         = <T>(args:any[]):T => (Buffer.isBuffer(args[1]) ? JSON.parse(args[1].toString()) : args[1]) as T;
export const getBodyParam    = <T>(name:string) => (args:any[]) => getBody<any>(args)[name] as T;
export const getFile         = pipe(getBody<{file:any}>, prop<any, any>("files"), prop("file"));

export const getParamsAndBody = pipeTo(merge<any>, getParams, getBody<Query>);

export const getQuery        = (args:any[]):Query => args[1] as Query;
export const getQueryParam   = <T>(name:string) => (args:any[]) => getQuery(args)[name] as T;

export const getHeaders      = (args:any[]):Headers => args[2] as Headers;
export const getHeader       = (name:string) => (args:any[]):string => (getHeaders(args) as any)[name];
export const getEnv          = at<NodeJS.ProcessEnv>(3);
export const getEnvVar       = (name:string) => pipe(getEnv, prop<any, any>(name));
export const getLoginToken   = pipe(getHeader('authorization'), defaultValue(""), split(" "), at(1));
export const getPublicUser   = memoizePromise(async () => User.loadByName("public"), {});
export const getLoggedInUser = async (args:any[]):Promise<string | null> => {
    const token = getLoginToken(args);
    let userId:string | null = null;
    if (!token) {
        // If no token is found, load the public user
        const publicUser = await getPublicUser();
        userId = publicUser.id;
    } else {
        // Get the user id from the login token
        userId = (jwt.verify(token, secret()) as jwt.JwtPayload).userId;
    }
    return userId;
}

export const getUserPermissions = memoizePromise(async (args:any[]) => {
    const userId = await getLoggedInUser(args);
    return userId ? await User.permissions.get(userId) : [];
}, {ttl: 1000 * 60 * 5});
