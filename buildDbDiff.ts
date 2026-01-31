import knex, { Knex } from 'knex';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ANSI Color Codes
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

// Helper to load env and create config
const getKnexConfig = (envFile: string): Knex.Config => {
    const envPath = path.resolve(__dirname, '../../', envFile);
    if (!fs.existsSync(envPath)) {
        throw new Error(`Environment file not found: ${envPath}`);
    }

    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    
    return {
        client: envConfig.DB_CLIENT || 'pg',
        connection: {
            host: envConfig.DB_HOST || "",
            user: envConfig.DB_USER || "",
            password: envConfig.DB_PASSWORD || "",
            database: envConfig.DB_DATABASE || "",
            port: parseInt(envConfig.DB_PORT || "5432"),
            ssl: envConfig.DB_SSL === "on" ? { rejectUnauthorized: false } : false,
        },
        pool: { min: 0, max: 1, idleTimeoutMillis: 100, reapIntervalMillis: 100 },
    };
};

interface ColumnInfo {
    column_name: string;
    data_type: string;
    is_nullable: string;
    character_maximum_length: number | null;
}

interface TableSchema {
    [columnName: string]: ColumnInfo;
}

interface DatabaseSchema {
    [tableName: string]: TableSchema;
}

const getSchema = async (db: Knex): Promise<DatabaseSchema> => {
    const columns = await db('information_schema.columns')
        .where('table_schema', 'public')
        .select('table_name', 'column_name', 'data_type', 'is_nullable', 'character_maximum_length');

    const schema: DatabaseSchema = {};

    for (const col of columns) {
        if (!schema[col.table_name]) {
            schema[col.table_name] = {};
        }
        schema[col.table_name][col.column_name] = {
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            character_maximum_length: col.character_maximum_length
        };
    }

    return schema;
};

const run = async () => {
    console.log("Loading configurations...");
    const localConfig = getKnexConfig('.env');
    const prodConfig = getKnexConfig('.env.prod');

    console.log("Connecting to databases...");
    const localDb = knex(localConfig);
    const prodDb = knex(prodConfig);

    try {
        console.log("Fetching schemas...");
        const [localSchema, prodSchema] = await Promise.all([
            getSchema(localDb),
            getSchema(prodDb)
        ]);

        console.log("Comparing schemas...\n");

        const allTables = new Set([...Object.keys(localSchema), ...Object.keys(prodSchema)]);
        let hasDifferences = false;

        for (const table of allTables) {
            const localTable = localSchema[table];
            const prodTable = prodSchema[table];

            if (!localTable) {
                console.log(`${RED}[-] Table '${table}' exists in PROD but not in LOCAL.${RESET}`);
                hasDifferences = true;
                continue;
            }

            if (!prodTable) {
                console.log(`${GREEN}[+] Table '${table}' exists in LOCAL but not in PROD.${RESET}`);
                hasDifferences = true;
                continue;
            }

            const allColumns = new Set([...Object.keys(localTable), ...Object.keys(prodTable)]);
            
            for (const col of allColumns) {
                const localCol = localTable[col];
                const prodCol = prodTable[col];

                if (!localCol) {
                    console.log(`${RED}    [-] Column '${col}' in table '${table}' exists in PROD but not in LOCAL.${RESET}`);
                    hasDifferences = true;
                    continue;
                }

                if (!prodCol) {
                    console.log(`${GREEN}    [+] Column '${col}' in table '${table}' exists in LOCAL but not in PROD.${RESET}`);
                    hasDifferences = true;
                    continue;
                }

                // Detailed comparison
                const differences: string[] = [];
                
                // Mismatches (Yellow)
                if (localCol.data_type !== prodCol.data_type) {
                     // Filter out integer vs bigint noise if desired, but for now just show it
                    differences.push(`${YELLOW}Type: ${localCol.data_type} (Local) vs ${prodCol.data_type} (Prod)${RESET}`);
                }
                if (localCol.is_nullable !== prodCol.is_nullable) {
                    differences.push(`${YELLOW}Nullable: ${localCol.is_nullable} (Local) vs ${prodCol.is_nullable} (Prod)${RESET}`);
                }
                 // Fix for 255 vs '255'
                 if (String(localCol.character_maximum_length) !== String(prodCol.character_maximum_length)) {
                    differences.push(`${YELLOW}Max Length: ${localCol.character_maximum_length} (Local) vs ${prodCol.character_maximum_length} (Prod)${RESET}`);
                 }

                if (differences.length > 0) {
                    console.log(`${CYAN}[~] Table '${table}' Column '${col}' mismatch:${RESET}`);
                    differences.forEach(d => console.log(`        ${d}`));
                    hasDifferences = true;
                }
            }
        }

        if (!hasDifferences) {
            console.log(`\n${GREEN}\u2705 Databases are identical.${RESET}`);
        } else {
            console.log(`\n${RED}\u26A0  Differences found.${RESET}`);
        }

    } catch (error) {
        console.error(`${RED}Error during diff:${RESET}`, error);
    } finally {
        await localDb.destroy();
        await prodDb.destroy();
    }
};

run();
