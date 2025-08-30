import { config } from 'dotenv';
import readline from "node:readline/promises";

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
    const {migrations} = require("../../migrations");

    const migration = await chooseMigration(migrations);
    const direction = await chooseDirection();


    console.log(`You have chosen migration: ${migration.name} (${migration.module}) - ${direction} in ${environment} environment`);
    const proceed = await confirmAction('Do you want to continue? (yes/no): ');
    if(!proceed) {
        console.log('Migration cancelled');
        process.exit(0);
    }

    if(direction === 'up') {
        await migration.up();
        await migration.initData();
        console.log('Migration complete');
    } else {
        await migration.down();
        console.log('Rollback complete');
    }
}

run();