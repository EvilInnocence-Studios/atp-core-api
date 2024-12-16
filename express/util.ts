import { Response } from "express";
import { at, map, pipe, prop } from "ts-functional";
import { Func } from "ts-functional/dist/types";
import { Params, Query } from "../../core-shared/express/types";
import { database } from "../database";

const db = database();

export const getParams      = (args:any[]):Params => args[0] as Params;
export const getParam       = <T>(name:string) => (args:any[]) => getParams(args)[name] as T;

export const getBody        = <T>(args:any[]):T => args[1] as T;
export const getBodyParam   = <T>(name:string) => (args:any[]) => getBody<any>(args)[name] as T;

export const getQuery       = (args:any[]):Query => args[1] as Query;
export const getQueryParam  = <T>(name:string) => (args:any[]) => getQuery(args)[name] as T;

export const getHeaders     = (args:any[]):Headers => args[2] as Headers;
export const getHeader      = (name:string) => (args:any[]) => (getHeaders(args) as any)[name] as string;
export const getEnv         = at<NodeJS.ProcessEnv>(3);
export const getEnvVar      = (name:string) => pipe(getEnv, prop<any, any>(name));

export const addCors = (response:Response) => {
    response.append('Access-Control-Allow-Origin', "*");
    response.append('Access-Control-Allow-Credentials', "true");
}

export const addJson = (response:Response) => {
    response.append('Content-Type', 'application/json');
};

interface IError {
    statusCode: number;
    message: string;
}

const isError = (e:any):e is IError => e.message && e.statusCode;
export const error = (statusCode:number, message:string):IError => ({statusCode, message});
export const error403 = error(403, "Permission denied");

// More fully type this
export const catchErrors = async <T>(response:Response, f:() => Promise<T>) => {
    f()
        .then((results:T) => {
            response.statusCode = 200;
            // addCors(response);
            addJson(response);
            response.send(JSON.stringify(results));
        })
            
        .catch(e => {
            console.log(e);
            const err:IError = isError(e) ? e : {
              message: `Something bad happened. I don't know what else to tell you. :( -- ${JSON.stringify(e)}`,
              statusCode: 500,
            };
            
            response.statusCode = e.statusCode || 500;
            // addCors(response);
            addJson(response);
            response.send(JSON.stringify(process.env.ENV === "local"
                ? {message: e.message, details: e, env: process.env}
                : {message: e.message}
            ));
        });
};

export const parseNestedQuery = (query:any) => Object.keys(query)
    .map((q:string):[string, string[]] => [q, q.replace(/\]/g, "").split("[")])
    .reduce((all:any, [key, q]:[string, string[]]) => {
        let curObj = all;
        const lastParam:string = q.pop() as string;
        q.forEach(p => {
            if(typeof curObj[p] === 'undefined') {curObj[p] = {};}
            curObj = curObj[p];
        });
        curObj[lastParam] = query[key].length > 1 ? query[key] : query[key][0];
        return all;
    }, {});

export const transform = <T, R>(obj:T) => obj as unknown as R;

export const create = <T, NewT, R = T>(table:string, nameField:string, afterLoad:Func<T, R> = transform) => async (newObj: NewT): Promise<R> => {
    try {
        const [insertedObj] = await db
            .insert(newObj, "*")
            .into(table);
        return insertedObj;
    } catch (e: any) {
        if (e.code === '23505') { // Assuming PostgreSQL unique violation error code
            const existingRecord = await db
                .select('*')
                .from(table)
                .where({ [nameField]: (newObj as any)[nameField] })
                .first();
            return afterLoad(existingRecord);
        } else {
            throw e;
        }
    }
};

export const search = <T, R = T>(table:string, searchField:string = "name", afterLoad:Func<T, R> = transform) =>
    ({q, perPage, offset}: Query = {} as Query):Promise<R[]> => db
        .select("*")
        .from(table)
        .where(searchField, "like", `${q || ""}%`)
        .orderBy(searchField)
        .offset(offset || 0)
        .limit(perPage || 999999)
        .then(map(afterLoad));

export const loadById = <T, R = T>(table:string, afterLoad:Func<T, R> = transform) => (id:number):Promise<R> => db
    .select("*")
    .from(table)
    .where({ id })
    .first()
    .then(afterLoad);

export const loadBy = <T, R = T>(field:string, table:string, afterLoad:Func<T, R> = transform) => (value:string):Promise<R> => db
    .select("*")
    .from(table)
    .where({ [field]:value })
    .first()
    .then(afterLoad);

export const update = <T, R = T>(table:string) => (id:number, updated:Partial<T>):Promise<R> => db
    .update(updated)
    .into(table)
    .where({ id })
    .then(() => loadById<T, R>(table)(id));

export const remove = (table:string) => (id:number):Promise<any> => db.delete().from(table).where({ id });