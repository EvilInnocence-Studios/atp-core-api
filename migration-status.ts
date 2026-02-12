import { chooseEnvironment, database } from "./database";

export const checkStatus = async (): Promise<any[] | string> => {
    try {
        await chooseEnvironment();

        const db = database();
        const moduleVersions = await db.select("*").from("_migrations");
        return moduleVersions;
    } catch(e) {
        return "Database is not initialized.";
    }
}

if(process.argv[1] === __filename) {
    checkStatus().then(console.log);
}
