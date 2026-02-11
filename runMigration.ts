import { config } from 'dotenv';
import readline from "node:readline/promises";
import { IMigration } from './dbMigrations';

const chooseEnvironment = async (): Promise<"prod" | "local"> => {
    // Check CLI arguments first
    const envArg = process.argv.find(arg => arg.startsWith('--env='));
    if (envArg) {
        const env = envArg.split('=')[1];
        if (env === 'prod' || env === 'local') return env;
    }

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

    // Check CLI for migration selection
    const migrationArg = process.argv.find(arg => arg.startsWith('--migration='));
    let migration: IMigration;
    if (migrationArg) {
        const name = migrationArg.split('=')[1];
        if (name.toLowerCase() === 'all') {
            migration = runAllMigration;
        } else {
            const found = migrations.find(m => m.name.toLowerCase() === name.toLowerCase());
            if (!found) throw new Error(`Migration not found: ${name}`);
            migration = found;
        }
    } else {
        const { chooseMigration } = require("./dbMigrations");
        migration = await chooseMigration([runAllMigration, ...migrations]);
    }

    // Check CLI for direction
    let direction: "up" | "down";
    if (process.argv.includes('--up')) {
        direction = 'up';
    } else if (process.argv.includes('--down')) {
        direction = 'down';
    } else {
        const { chooseDirection } = require("./dbMigrations");
        direction = await chooseDirection();
    }

    console.log(`You have chosen migration: ${migration.name} (${migration.module}) - ${direction} in ${environment} environment`);
    
    // Check CLI for confirmation
    const isUnattended = process.argv.some(arg => arg === '--yes' || arg === '-y');
    const { confirmAction } = require("./dbMigrations");
    const proceed = isUnattended || await confirmAction('Do you want to continue?');
    
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