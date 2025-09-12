import { map } from "ts-functional";
import { Func } from "ts-functional/dist/types";
import { NewObj } from "../../../core-shared/express/types";
import { database } from "../../database";
import { create, loadBy, loadById, loadByInsensitive, remove, search, transform, update } from "../util";

const db = database();

const defaultCrudHooks = {
    afterLoad: transform,
    beforeCreate: transform,
    beforeUpdate: transform,
    afterCreate: () => {},
}

export const basicCrudService = <
    Entity extends {id: string},
    NewEntity = NewObj<Entity>,
    EntityUpdate = Partial<Entity>,
    ReturnedEntity extends {id:string} = Entity,
>(
    table:string, nameField:string = "name",
    hooks: Partial<{
        afterLoad: Func<Entity, ReturnedEntity>;
        beforeCreate: Func<NewEntity, NewObj<Entity>>;
        beforeUpdate: Func<EntityUpdate, Partial<Entity>>;
        afterCreate: Func<Entity, void>;
    }> = {},
) => {
    const { afterLoad, beforeCreate, beforeUpdate, afterCreate } = { ...defaultCrudHooks, ...hooks };

    return {
        create:            create<Entity, NewEntity, ReturnedEntity>(table, nameField, beforeCreate, afterLoad, afterCreate),
        search:            search<Entity, ReturnedEntity>(table, nameField, afterLoad),
        loadById:          loadById<Entity, ReturnedEntity>(table, afterLoad),
        loadByName:        loadBy<Entity, ReturnedEntity>(nameField, table, afterLoad),
        loadBy:            (field:string) => loadBy<Entity, ReturnedEntity>(field, table, afterLoad),
        loadByInsensitive: (field:string) => loadByInsensitive<Entity, ReturnedEntity>(field, table, afterLoad),
        update:            update<Entity, EntityUpdate, ReturnedEntity>(table, beforeUpdate, afterLoad),
        remove:            remove(table),
    };
}

const defaultRelationHooks = {
    afterLoad: transform,
    afterAdd: () => Promise.resolve(),
    afterRemove: () => Promise.resolve(),
}

export const basicRelationService = <R, T = R>(
    relationTable: string, relationField: string,
    otherTable: string, otherTableIdField: string,
    hooks: Partial<{
        afterLoad:Func<T, R>,
        afterAdd:(relationId: string, id: string) => Promise<any>,
        afterRemove:(relationId: string, id: string) => Promise<any>,
    }> = {},
) => {
    const {afterAdd, afterLoad, afterRemove} = { ...defaultRelationHooks, ...hooks };

    return {
        add: async (relationId: string, otherId: string) => {
            await db
                .insert({ [relationField]: relationId, [otherTableIdField]: otherId })
                .into(relationTable);
            
            return afterAdd(relationId, otherId);
        },

        remove: async (relationId: string, otherId: string) => {
            await db
                .delete()
                .from(relationTable)
                .where({ [relationField]: relationId, [otherTableIdField]: otherId });

            return afterRemove(relationId, otherId);
        },

        get: (id: string):Promise<R[]> => db
            .select(`${otherTable}.*`)
            .from(otherTable)
            .join(relationTable, `${otherTable}.id`, `${relationTable}.${otherTableIdField}`)
            .where(`${relationTable}.${relationField}`, id)
            .then(map(afterLoad)),
    };
};

const defaultTwoWayRelationHooks = {
    afterLoad: transform,
};

export const twoWayRelationService = <R, T = R>(
    tableAIdField: string, intermediateIdField: string, tableBIdField: string,
    relationTableA: string, relationTableB: string, tableB: string,
    hooks: Partial<{
        afterLoad: Func<T, R>;
    }> = {},
) => {
    const {afterLoad} = { ...defaultTwoWayRelationHooks, ...hooks };

    return {
        get: (id: string): Promise<R[]> => db
            .select(`${tableB}.*`)
            .from(tableB)
            .join(relationTableB, `${tableB}.id`, `${relationTableB}.${tableBIdField}`)
            .join(relationTableA, `${relationTableB}.${intermediateIdField}`, `${relationTableA}.${intermediateIdField}`)
            .where(`${relationTableA}.${tableAIdField}`, id)
            .then(map(afterLoad)),
    };
}
