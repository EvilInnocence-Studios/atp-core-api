import { chooseEnvironment } from './database';
import { IMigration } from './dbMigrations';

const run = async () => {
    const environment = await chooseEnvironment();

    const { confirmAction } = require("./dbMigrations");
    const { setupMigrations } = require("../../api.config") as { setupMigrations: IMigration[] };

    if (!setupMigrations || setupMigrations.length === 0) {
        console.log("No setup migrations found.");
        process.exit(0);
    }

    // Sort migrations by order
    setupMigrations.sort((a, b) => a.order - b.order);

    console.log(`Found ${setupMigrations.length} setup migrations:`);
    setupMigrations.forEach((m, i) => {
        console.log(`${i + 1}. ${m.name} (${m.module}) - ${m.description}`);
    });

    console.log(`\nEnvironment: ${environment}`);
    const isUnattended = process.argv.some(arg => arg === '--yes' || arg === '-y');
    const proceed = isUnattended || await confirmAction('Do you want to run all setup migrations? (yes/no): ');
    
    if (!proceed) {
        console.log('Database setup cancelled');
        process.exit(0);
    }

    console.log("Starting database setup...");
    for (const m of setupMigrations) {
        console.log(`\nRunning: ${m.name} (${m.module})`);
        try {
            await m.up();
            await m.initData();
            console.log(`Success: ${m.name}`);
        } catch (error) {
            console.error(`Error running migration ${m.name}:`, error);
            const cont = await confirmAction('Do you want to continue with the next migration? (yes/no): ');
            if (!cont) {
                console.log('Setup aborted');
                process.exit(1);
            }
        }
    }

    console.log('\nDatabase setup complete!');
    process.exit(0);
}

run();
