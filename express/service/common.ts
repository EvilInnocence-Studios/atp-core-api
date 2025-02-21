import { filter, map } from "ts-functional";
import { Func } from "ts-functional/dist/types";
import { NewObj } from "../../../core-shared/express/types";
import { database } from "../../database";
import { create, loadBy, loadById, remove, search, transform, update } from "../util";

const db = database();

export const basicCrudService = <
    Entity extends {id: string},
    NewEntity = NewObj<Entity>,
    EntityUpdate = Partial<Entity>,
    ReturnedEntity extends {id:string} = Entity,
>(
    table:string, nameField:string = "name",
    afterLoad:Func<Entity, ReturnedEntity> = transform,
    beforeCreate: Func<NewEntity, NewObj<Entity>> = transform,
    beforeUpdate:Func<EntityUpdate, Partial<Entity>> = transform,
    afterCreate: Func<Entity, void> = () => {},
) => ({
    create:     create<Entity, NewEntity, ReturnedEntity>(table, nameField, beforeCreate, afterLoad),
    search:     search<Entity, ReturnedEntity>(table, nameField, afterLoad),
    loadById:   loadById<Entity, ReturnedEntity>(table, afterLoad),
    loadByName: loadBy<Entity, ReturnedEntity>(nameField, table, afterLoad),
    loadBy:     (field:string) => loadBy<Entity, ReturnedEntity>(field, table, afterLoad),
    update:     update<Entity, EntityUpdate, ReturnedEntity>(table, beforeUpdate, afterLoad),
    remove:     remove(table),
});

const defaultHooks = {
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
    const mergedHooks = { ...defaultHooks, ...hooks };

    return {
        add: async (relationId: string, id: string) => {
            await db
                .insert({ [relationField]: relationId, [otherTableIdField]: id })
                .into(relationTable)
                .onConflict([relationField, otherTableIdField])
                .ignore();
            
            return mergedHooks.afterAdd(relationId, id);
        },

        remove: async (relationId: string, id: string) => {
            await db
                .delete()
                .from(relationTable)
                .where({ [relationField]: relationId, [otherTableIdField]: id });

            return mergedHooks.afterRemove(relationId, id);
        },

        get: (id: string):Promise<R[]> => db
            .select(`${otherTable}.*`)
            .from(otherTable)
            .join(relationTable, `${otherTable}.id`, `${relationTable}.${otherTableIdField}`)
            .where(`${relationTable}.${relationField}`, id)
            .then(map(mergedHooks.afterLoad)),
    };
};

export const twoWayRelationService = <R, T = R>(
    tableAIdField: string, intermediateIdField: string, tableBIdField: string,
    relationTableA: string, relationTableB: string, tableB: string,
    afterLoad: Func<T, R> = transform,
) => ({
    get: (id: string): Promise<R[]> => db
        .select(`${tableB}.*`)
        .from(tableB)
        .join(relationTableB, `${tableB}.id`, `${relationTableB}.${tableBIdField}`)
        .join(relationTableA, `${relationTableB}.${intermediateIdField}`, `${relationTableA}.${intermediateIdField}`)
        .where(`${relationTableA}.${tableAIdField}`, id)
        .then(map(afterLoad)),
});