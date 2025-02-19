import { Response } from "express";
import { map, objFilter } from "ts-functional";
import { Func, Index } from "ts-functional/dist/types";
import { NewObj, Query, QueryArrayValue, QuerySingleValue, QueryValue } from "../../core-shared/express/types";
import { database } from "../database";
import { error500 } from "./errors";

const db = database();

export const addCors = (response:Response) => {
    response.append('Access-Control-Allow-Origin', "*");
    response.append('Access-Control-Allow-Credentials', "true");
}

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
    Entity extends {id: string},
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

export const loadById = <T, R = T>(table:string, afterLoad:Func<T, R> = transform) => (id:string):Promise<R> => db
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
    Entity extends {id: string},
    EntityUpdate = Partial<Entity>,
    ReturnedEntity = Entity,
>(
    table:string,
    beforeUpdate:Func<EntityUpdate, Partial<Entity>> = transform,
    afterLoad: Func<Entity, ReturnedEntity> = transform,
) => (id:string, updated:EntityUpdate):Promise<ReturnedEntity> => db
    .update(beforeUpdate(updated))
    .into(table)
    .where({ id })
    .then(() => loadById<Entity, ReturnedEntity>(table, afterLoad)(id));

export const remove = (table:string) => (id:string):Promise<any> => db.delete().from(table).where({ id });

export const mapKeys = (f:Func<string, string>) => (obj:Index<any>):Index<any> => Object.keys(obj).reduce(
    (all:Index<any>, key:string) => {
        all[f(key)] = obj[key];
        return all;
    },
    {}
);

// TODO: Test this
export const reorder = async <T extends {id: string, order: number}>(table:string, entityId: string, newIndex: number, where?:Index<any>) => {
    // Get all items that match the where clause
    const items:T[] = await db(table).where(where || {}).orderBy("order");

    // Find the index of the entity to reorder
    const oldIndex = items.findIndex(item => item.id === entityId);

    // If the entity is not found, throw an error
    if(oldIndex === -1) {
        throw error500(`Entity with id ${entityId} not found in table ${table}`);
    }

    // If the entity is already in the correct position, return
    if(oldIndex === newIndex) {
        return Promise.resolve();
    }

    // Reorder the items
    const reordered = oldIndex < newIndex
        ? [
            ...items.slice(0, oldIndex),
            ...items.slice(oldIndex + 1, newIndex + 1),
            items[oldIndex],
            ...items.slice(newIndex + 1),
        ]
        : [
            ...items.slice(0, newIndex),
            items[oldIndex],
            ...items.slice(newIndex, oldIndex),
            ...items.slice(oldIndex + 1),
        ];

    // Update the order of the items in the database
    await Promise.all(reordered.map((item, order) => db(table).update({ order }).where({ id: item.id })));
}