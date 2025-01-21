import { map } from "ts-functional";
import { Func } from "ts-functional/dist/types";
import { NewObj } from "../../../core-shared/express/types";
import { database } from "../../database";
import { create, loadBy, loadById, remove, search, transform, update } from "../util";

const db = database();

export const basicCrudService = <
    Entity extends {id: number},
    NewEntity = NewObj<Entity>,
    EntityUpdate = Partial<Entity>,
    ReturnedEntity extends {id:number} = Entity,
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

export const basicRelationService = <R, T = R>(
    relationTable: string, relationField: string,
    otherTable: string, otherTableIdField: string,
    afterLoad:Func<T, R> = transform
) => ({
    add: (relationId: number, id: number) => db
        .insert({ [relationField]: relationId, [otherTableIdField]: id })
        .into(relationTable)
        .onConflict([relationField, otherTableIdField])
        .ignore(),

    remove: (relationId: number, id: number) => db
        .delete()
        .from(relationTable)
        .where({ [relationField]: relationId, [otherTableIdField]: id }),

    get: (id: number):Promise<R[]> => db
        .select(`${otherTable}.*`)
        .from(otherTable)
        .join(relationTable, `${otherTable}.id`, `${relationTable}.${otherTableIdField}`)
        .where(`${relationTable}.${relationField}`, id)
        .then(map(afterLoad)),
});

export const twoWayRelationService = <R, T = R>(
    tableAIdField: string, intermediateIdField: string, tableBIdField: string,
    relationTableA: string, relationTableB: string, tableB: string,
    afterLoad: Func<T, R> = transform
) => ({
    get: (id: number): Promise<R[]> => db
        .select(`${tableB}.*`)
        .from(tableB)
        .join(relationTableB, `${tableB}.id`, `${relationTableB}.${tableBIdField}`)
        .join(relationTableA, `${relationTableB}.${intermediateIdField}`, `${relationTableA}.${intermediateIdField}`)
        .where(`${relationTableA}.${tableAIdField}`, id)
        .then(map(afterLoad)),
});