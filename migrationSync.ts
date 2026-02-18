import { config } from 'dotenv';
import { MigrationRunner } from './migrationRunner';

const run = async () => {
    try {
        const envArg = process.argv.find(arg => arg.startsWith('--env='));
        const env = envArg ? envArg.split('=')[1] : 'local';
        
        if (env === 'prod') {
            config({ path: '.env.prod' });
        } else {
            config({ path: '.env' });
        }

        const runner = new MigrationRunner();
        const count = await runner.runPending();
        console.log(`Successfully applied ${count} migrations.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
