import { database } from "../../../core/database";
import { downloadMedia, removeMedia, uploadMedia } from "../../../core/s3Uploads";
import { error409 } from "../errors";

const db = database();

// For entities that are primarily media files (e.g. banners, user avatars, etc.)
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
            .onConflict(uniqueColumns).merge();

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

// For entities that have media files as optional fields (e.g. comic arcs, characters, etc.)
export const optionalMediaService = <T>(params:{
    dbTable: string,
    mediaColumn: keyof T,
    getFolder:() => Promise<string>,
    getEntity: (id:string) => Promise<T>,
    getFileName: (entity:T) => string | null,
}) => ({
    upload: async (id: string, overwrite: boolean, file:File):Promise<T> => {
        const { dbTable, mediaColumn, getFolder, getEntity, getFileName } = params;

        const entity:T = await getEntity(id);
        const existingFile = getFileName(entity);

        // Upload file to S3
        try {
            await uploadMedia(await getFolder(), file, {failOnExist: !overwrite});
        } catch(e) {
            console.log(e);
            throw error409("File already exists");
        }

        // Remove existing file from S3 if overwriting
        if(overwrite && existingFile) {
            await removeMedia(await getFolder(), existingFile);
        }

        // Update record in database
        const [updatedEntity] = await db(dbTable)
            .where({ id })
            .update({ [mediaColumn]: file.name } as any, "*");

        return updatedEntity;
    },
    remove: async (id: string):Promise<T> => {
        const { dbTable, mediaColumn, getFolder, getEntity, getFileName } = params;

        const entity:T = await getEntity(id);
        const existingFile = getFileName(entity);

        if(existingFile) {
            // Remove file from S3
            await removeMedia(await getFolder(), existingFile);

            // Update record in database
            const [updatedEntity] = await db(dbTable)
                .where({ id })
                .update({ [mediaColumn]: null } as any, "*");

            return updatedEntity;
        }

        return entity;
    },
    replace: async (id: string, file:File):Promise<T> => {
        const { dbTable, mediaColumn, getFolder, getEntity, getFileName } = params;

        const entity:T = await getEntity(id);
        const existingFile = getFileName(entity);

        // Remove existing file from S3
        if(existingFile) {
            await removeMedia(await getFolder(), existingFile);
        }

        // Upload new file to S3
        await uploadMedia(await getFolder(), file);

        // Update record in database
        const [updatedEntity] = await db(dbTable)
            .where({ id })
            .update({ [mediaColumn]: file.name } as any, "*");
        return updatedEntity;
    }
});