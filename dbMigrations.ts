import readline from "node:readline/promises";

export declare interface IMigrationParameter {
    name: string;
    description: string;
}

export declare interface IMigration {
    name: string;
    module: string;
    description: string;
    order: number;
    version: string;
    downVersion?: string;
    parameters?: IMigrationParameter[];
    up: (params?: Record<string, string>) => Promise<any>;
    down: (params?: Record<string, string>) => Promise<any>;
    initData: (params?: Record<string, string>) => Promise<any>;
};

// Show the user a list of migrations and allow them to choose one via arrow keys, index, or id
export const chooseMigration = async (migrations:IMigration[]): Promise<IMigration> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("Available migrations:");
    migrations.forEach((migration, index) => {
        console.log(`${index + 1}. ${migration.name}(${migration.module}) \n\t ${migration.description}`);
    });

    const answer = await rl.question("Enter the number or name of the migration to choose: ");
    rl.close();

    const index = parseInt(answer, 10) - 1;
    if (!isNaN(index) && index >= 0 && index < migrations.length) {
        return migrations[index];
    }

    const migration = migrations.find(m => m.name.toLowerCase() === answer.toLowerCase());
    if (migration) {
        return migration;
    }

    throw new Error(`Migration not found: ${answer}`);
}

export const chooseDirection = async (): Promise<"up" | "down"> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const answer = await rl.question("Enter migration direction (up/down): ");
    rl.close();

    if (answer.toLowerCase() === "up") {
        return "up";
    } else if (answer.toLowerCase() === "down") {
        return "down";
    } else {
        throw new Error(`Invalid direction: ${answer}`);
    }
}

export const confirmAction = async (message: string): Promise<boolean> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const answer = await rl.question(`${message} (yes/no): `);
    rl.close();

    return answer.toLowerCase() === "yes";
}

export const askParameter = async (name: string, description: string): Promise<string> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const answer = await rl.question(`Enter value for ${name}: (${description}): `);
    rl.close();

    return answer;
}

export const gatherParameters = async (migrationsToRun: IMigration[]): Promise<Record<string, string>> => {
    const params: Record<string, string> = {};
    const requiredParams = new Map<string, string>(); // name -> description

    for (const m of migrationsToRun) {
        if (m.parameters) {
            for (const p of m.parameters) {
                if (!requiredParams.has(p.name)) {
                    requiredParams.set(p.name, p.description);
                }
            }
        }
    }

    for (const [name, description] of requiredParams.entries()) {
        const cliArg = process.argv.find(arg => arg.startsWith(`--${name}=`));
        if (cliArg) {
            params[name] = cliArg.substring(cliArg.indexOf('=') + 1);
        } else {
            params[name] = await askParameter(name, description);
        }
    }

    return params;
}