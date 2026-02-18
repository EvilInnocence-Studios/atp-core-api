import { chooseEnvironment, database } from './database';
import { IMigration } from './dbMigrations';

const run = async () => {
    const environment = await chooseEnvironment();

    const { migrations: rawMigrations } = require("../../migrations") as { migrations: IMigration[] };

    // Sort migrations by order
    const migrations = rawMigrations.sort((a, b) => a.order - b.order);

    const runAllMigration: IMigration = {
        name: "Run All Migrations",
        module: "system",
        description: "Run all migrations in sequence",
        version: "1.0.0",
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

export const runSingleMigration = async (migration:IMigration, direction:"up" | "down") => {
    if (direction === 'up') {
        await migration.up();
        await migration.initData();
        await updateMigrationVersion(migration.module, migration.version);
        console.log(`${migration.name} (${migration.module}) Migration complete to version ${migration.version}`);
    } else {
        await migration.down();
        await updateMigrationVersion(migration.module, migration.downVersion || "");
        console.log(`${migration.name} (${migration.module}) Rollback complete to version ${migration.downVersion}`);
    }    
}

export const runMigrations = async (migrations:IMigration[], direction:"up" | "down") => {
    for (const migration of migrations.sort((a, b) => a.order - b.order)) {
        await runSingleMigration(migration, direction);
    }
    console.log(`All migrations complete`);
}

const updateMigrationVersion = async (module: string, version:string) => {
    const db = database();
    await db
        .insert({module, version})
        .into("_migrations")
        .onConflict().merge();
}

run();
