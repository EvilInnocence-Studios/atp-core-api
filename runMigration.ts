import { config } from 'dotenv';
import readline from "node:readline/promises";
import { IMigration } from './dbMigrations';

const chooseEnvironment = async (): Promise<"prod" | "local"> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const answer = await rl.question("Enter environment (prod/local): ");
    rl.close();

    if (answer.toLowerCase() === "prod") {
        return "prod";
    } else if (answer.toLowerCase() === "local") {
        return "local";
    } else {
        throw new Error(`Invalid environment: ${answer}`);
    }
}

const run = async () => {
    const environment = await chooseEnvironment();

    // Load environment variables based on environment parameter
    if (environment === 'prod') {
        config({ path: '.env.prod' });
    } else {
        config({ path: '.env' });
    }

    const { chooseDirection, chooseMigration, confirmAction } = require("./dbMigrations");
    const { migrations: rawMigrations } = require("../../migrations") as { migrations: IMigration[] };

    // Sort migrations by order
    const migrations = rawMigrations.sort((a, b) => a.order - b.order);

    const runAllMigration: IMigration = {
        name: "Run All Migrations",
        module: "system",
        description: "Run all migrations in sequence",
        order: 0,
        up: async () => {
            console.log("Starting execution of all migrations...");
            for (const m of migrations) {
                console.log(`Running migration: ${m.name} (${m.module})`);
                await m.up();
                await m.initData();
            }
        },
        down: async () => {
            console.log("Starting rollback of all migrations...");
            for (const m of [...migrations].reverse()) {
                console.log(`Rolling back migration: ${m.name} (${m.module})`);
                await m.down();
            }
        },
        initData: async () => {
            // Already handled in up() for each migration
        }
    };

    const migration = await chooseMigration([runAllMigration, ...migrations]);
    const direction = await chooseDirection();

    console.log(`You have chosen migration: ${migration.name} (${migration.module}) - ${direction} in ${environment} environment`);
    const proceed = await confirmAction('Do you want to continue? (yes/no): ');
    if (!proceed) {
        console.log('Migration cancelled');
        process.exit(0);
    }

    if (direction === 'up') {
        await migration.up();
        await migration.initData();
        console.log('Migration complete');
    } else {
        await migration.down();
        console.log('Rollback complete');
    }
}

run();