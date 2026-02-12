import knex, { Knex } from "knex";
import { getDbConfig } from '../../config';
import { memoize } from "ts-functional";
import readline from "node:readline/promises";
import { config } from "dotenv";

export const database = memoize(() => knex(getDbConfig() as Knex.Config), {});

export const chooseEnvironment = async (): Promise<"prod" | "local"> => {
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

    if (answer.toLowerCase() === 'prod') {
        config({ path: '.env.prod' });
    } else {
        config({ path: '.env' });
    }

    if (answer.toLowerCase() === "prod") {
        return "prod";
    } else if (answer.toLowerCase() === "local") {
        return "local";
    } else {
        throw new Error(`Invalid environment: ${answer}`);
    }
}
