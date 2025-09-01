import { map } from "ts-functional";
import { Func } from "ts-functional/dist/types";
import { NewObj } from "../../../core-shared/express/types";
import { downloadMedia, removeMedia, uploadMedia } from "../../../core/s3Uploads";
import { database } from "../../database";
import { error409 } from "../errors";
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
        add: async (relationId: string, id: string) => {
            await db
                .insert({ [relationField]: relationId, [otherTableIdField]: id })
                .into(relationTable);
            
            return afterAdd(relationId, id);
        },

        remove: async (relationId: string, id: string) => {
            await db
                .delete()
                .from(relationTable)
                .where({ [relationField]: relationId, [otherTableIdField]: id });

            return afterRemove(relationId, id);
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

export const mediaService = <T>(params:{
    dbTable: string,
    uniqueColumns: string[],
    newRecord: (file:File) => Partial<T>,
    updateRecord: (file:File) => Partial<T>,
    getFolder:() => Promise<string>,
    getEntity: (id:string) => Promise<T>,
    getFileName: (entity:T) => string,
}) => ({
    upload: (overwrite: boolean) => async (file:File):Promise<T> => {
        const { dbTable, uniqueColumns, newRecord, getFolder } = params;

        // Upload file to S3
        try {
            await uploadMedia(await getFolder(), file, {failOnExist: !overwrite});
        } catch(e) {
            console.log(e);
            throw error409("File already exists");
        }

        // Create record in database
        // If unique key already exists, just return the existing record instead
        const mediaToInsert = newRecord(file);
        console.log(mediaToInsert);
        const [newMedia] = await db(dbTable)
            .insert(mediaToInsert, "*")
            .onConflict(uniqueColumns).ignore();

        return newMedia;
    },
    remove: async (id: string):Promise<null> => {
        const { dbTable, getFolder, getEntity, getFileName } = params;

        const entity:T = await getEntity(id);

        // Remove file from S3
        await removeMedia(await getFolder(), getFileName(entity));

        // Remove record from database
        await db(dbTable).where({ id }).delete();

        return null;
    },
    replace: async (id: string, file:File):Promise<T> => {
        const { dbTable, updateRecord, getFolder, getEntity, getFileName } = params;

        const entity:T = await getEntity(id);

        // Remove existing file from S3
        await removeMedia(await getFolder(), getFileName(entity));

        // Upload new file to S3
        await uploadMedia(await getFolder(), file);

        // Update record in database
        const mediaToUpdate = updateRecord(file);
        const [updatedMedia] = await db(dbTable)
            .where({ id })
            .update(mediaToUpdate, "*");

        return updatedMedia;
    },
    download: async (id:string) => {
        const { getFolder, getEntity, getFileName } = params;

        const entity:T = await getEntity(id);
        return downloadMedia(await getFolder(), getFileName(entity));
    }
});