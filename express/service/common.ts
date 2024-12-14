import { map } from "ts-functional";
import { Func } from "ts-functional/dist/types";
import { NewObj } from "../../../atp-core-shared/express/types";
import { database } from "../../database";
import { create, loadBy, loadById, remove, search, transform, update } from "../util";

const db = database();

export const basicCrudService = <T extends {id: number}, R = T>(table:string, nameField:string = "name", afterLoad:Func<T, R> = transform) => ({
    create:     create<T, NewObj<T>, R>(table, nameField, afterLoad),
    search:     search<T, R>(table, nameField, afterLoad),
    loadById:   loadById<T, R>(table, afterLoad),
    loadByName: loadBy<T, R>(nameField, table, afterLoad),
    update:     update<T, R>(table),
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