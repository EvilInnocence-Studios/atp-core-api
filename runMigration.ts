import 'dotenv/config';
import { chooseDirection, chooseMigration } from "./dbMigrations";

import {migrations} from "../../migrations";

const run = async () => {
    const migration = await chooseMigration(migrations);
    const direction = await chooseDirection();

    console.log(`You have chosen migration: ${migration.name} (${migration.module}) - ${direction}`);

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