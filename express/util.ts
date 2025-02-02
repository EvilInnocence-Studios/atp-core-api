import { Response } from "express";
import { at, defaultValue, map, objFilter, pipe, prop, split } from "ts-functional";
import { Func, Index } from "ts-functional/dist/types";
import { NewObj, Params, Query, QueryArrayValue, QuerySingleValue, QueryValue } from "../../core-shared/express/types";
import { database } from "../database";

const db = database();

export const getParams      = (args:any[]):Params => args[0] as Params;
export const getParam       = <T>(name:string) => (args:any[]) => getParams(args)[name] as T;

export const getBody        = <T>(args:any[]):T => (Buffer.isBuffer(args[1]) ? JSON.parse(args[1].toString()) : args[1]) as T;
export const getBodyParam   = <T>(name:string) => (args:any[]) => getBody<any>(args)[name] as T;
export const getFile        = pipe(getBody<{file:any}>, prop<any, any>("file"));

export const getQuery       = (args:any[]):Query => args[1] as Query;
export const getQueryParam  = <T>(name:string) => (args:any[]) => getQuery(args)[name] as T;

export const getHeaders     = (args:any[]):Headers => args[2] as Headers;
export const getHeader      = (name:string) => (args:any[]):string => (getHeaders(args) as any)[name];
export const getEnv         = at<NodeJS.ProcessEnv>(3);
export const getEnvVar      = (name:string) => pipe(getEnv, prop<any, any>(name));
export const getLoginToken  = pipe(getHeader('authorization'), defaultValue(""), split(" "), at(1));

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
export const error401 = error(401, "Unauthorized");
export const error403 = error(403, "Permission denied");
export const error500 = (message:string = "Something bad happened. I don't know what else to tell you. :("):IError => error(500, message);
export const error409 = (message:string = "Conflict"):IError => error(409, message);

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

export const create = <
    Entity extends {id: number},
    NewEntity = NewObj<Entity>,
    ReturnedEntity = Entity,
>(
    table:string, nameField:string,
    beforeCreate:Func<NewEntity, NewObj<Entity>> = transform,
    afterLoad:Func<Entity, ReturnedEntity> = transform,
    afterCreate:Func<Entity, void> = () => {},
) => async (newObj: NewEntity): Promise<ReturnedEntity> => {
    try {
        const [insertedObj] = await db
            .insert(beforeCreate(newObj), "*")
            .into(table);
        afterCreate(insertedObj);
        return afterLoad(insertedObj);
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

export const search = <T, R = T>(table:string, orderField: string, afterLoad:Func<T, R> = transform) =>
    ({offset, perPage, ...query}: Query = {} as Query):Promise<R[]> => {
        const whereIn:Index<QueryArrayValue> = objFilter(
            (value:QueryValue, key:string) => typeof value === 'object'
        )(query) as Index<QueryArrayValue>;

        const where:Index<QuerySingleValue> = objFilter(
            (value:QueryValue) => !(typeof value === 'object')
        )(query) as Index<QuerySingleValue>;

        const stmt = db
            .select("*")
            .from(table)
            .where(where);
            
        Object.keys(whereIn).forEach(key => {
            stmt.whereIn(key, whereIn[key]);
        });

        return stmt.orderBy(orderField)
            .offset(offset || 0)
            .limit(perPage || 999999)
            .then(map(afterLoad));
    }

export const loadById = <T, R = T>(table:string, afterLoad:Func<T, R> = transform) => (id:number):Promise<R> => db
    .select("*")
    .from(table)
    .where({ id })
    .first()
    .then(afterLoad);

export const loadBy = <T, R = T>(field:string, table:string, afterLoad:Func<T, R> = transform) => (value:any):Promise<R> => db
    .select("*")
    .from(table)
    .where({ [field]:value })
    .first()
    .then(afterLoad);

export const update = <
    Entity extends {id: number},
    EntityUpdate = Partial<Entity>,
    ReturnedEntity = Entity,
>(
    table:string,
    beforeUpdate:Func<EntityUpdate, Partial<Entity>> = transform,
    afterLoad: Func<Entity, ReturnedEntity> = transform,
) => (id:number, updated:EntityUpdate):Promise<ReturnedEntity> => db
    .update(beforeUpdate(updated))
    .into(table)
    .where({ id })
    .then(() => loadById<Entity, ReturnedEntity>(table, afterLoad)(id));

export const remove = (table:string) => (id:number):Promise<any> => db.delete().from(table).where({ id });

export const mapKeys = (f:Func<string, string>) => (obj:Index<any>):Index<any> => Object.keys(obj).reduce(
    (all:Index<any>, key:string) => {
        all[f(key)] = obj[key];
        return all;
    },
    {}
);