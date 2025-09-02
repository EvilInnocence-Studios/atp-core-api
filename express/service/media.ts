import { database } from "../../../core/database";
import { downloadMedia, removeMedia, uploadMedia } from "../../../core/s3Uploads";
import { error409 } from "../errors";

const db = database();

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