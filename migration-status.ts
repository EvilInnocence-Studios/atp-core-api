import { chooseEnvironment, database } from "./database";

export interface MigrationStatus {
    initialized: boolean;
    database?: string;
    reason?: string;
    migrations?: any[];
    tables?: string[];
}

export const checkStatus = async (): Promise<MigrationStatus> => {
    try {
        const env = await chooseEnvironment();
        const db = database();
        const dbConfig = db.client.config.connection;
        const dbInfo = `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

        // 1. Check if we can connect to the database server/database
        try {
            await db.raw('select 1');
        } catch (e: any) {
            // Check for common connection/existence errors
            if (e.code === '3D000') { // Postgres: database does not exist
                return { initialized: false, database: dbInfo, reason: "Database does not exist" };
            }
            if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') {
                return { initialized: false, database: dbInfo, reason: "Could not connect to database server" };
            }
            return { initialized: false, database: dbInfo, reason: `Database connection error: ${e.message}` };
        }

        // 2. Check if the migrations table exists
        try {
            const hasTable = await db.schema.hasTable("_migrations");
            const allTables = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            const tableList = allTables.rows.map((r: any) => r.table_name);

            if (!hasTable) {
                return { 
                    initialized: false, 
                    database: dbInfo, 
                    reason: "Migration table (_migrations) does not exist",
                    migrations: tableList // Return table list for debugging
                };
            }

            const moduleVersions = await db.select("*").from("_migrations");
            return {
                initialized: true,
                database: dbInfo,
                migrations: moduleVersions,
                tables: tableList // Add tables list for extra debugging
            };
        } catch (e: any) {
            return { initialized: false, database: dbInfo, reason: `Error checking migration table: ${e.message}` };
        }
    } catch (e: any) {
        return { initialized: false, reason: e.message || "Unknown error during initialization check" };
    }
}

if (require.main === module) {
    checkStatus().then(status => {
        console.log(JSON.stringify(status, null, 2));
    }).catch(err => {
        console.error(JSON.stringify({ initialized: false, reason: err.message }, null, 2));
    });
}
