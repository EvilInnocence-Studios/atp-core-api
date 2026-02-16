import knex, { Knex } from "knex";
import { getDbConfig } from '../../config';
import { memoize } from "ts-functional";
import readline from "node:readline/promises";
import { config } from "dotenv";

export const database = memoize(() => knex(getDbConfig() as Knex.Config), {});

export const chooseEnvironment = async (): Promise<"prod" | "local"> => {
    let answer = "";

    // Check CLI arguments first
    const envArg = process.argv.find(arg => arg.startsWith('--env='));
    if (envArg) {
        answer = envArg.split('=')[1];
    } else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        answer = await rl.question("Enter environment (prod/local): ");
        rl.close();
    }

    if (answer.toLowerCase() === 'prod') {
        config({ path: '.env.prod', override: true });
    } else {
        config({ path: '.env', override: true });
    }

    if (answer.toLowerCase() === "prod") {
        return "prod";
    } else if (answer.toLowerCase() === "local") {
        return "local";
    } else {
        throw new Error(`Invalid environment: ${answer}`);
    }
}
