import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { IInitializer, IMigration } from '../src/core/lib/database.d';

// Helper function to dynamically load init modules
const loadInitModules = (srcPath:string):IMigration[] => {
    const initModules:IMigration[] = [];
    const moduleDirs = fs.readdirSync(srcPath, { withFileTypes: true });

    moduleDirs.forEach((dir) => {
        if (dir.isDirectory()) {
            const initPath = path.join(srcPath, dir.name, 'migrations', 'init.ts');
            console.log(`Looking for initializer in ${initPath}`);
            if (fs.existsSync(initPath)) {
                const initModule:IInitializer = require(initPath);
                if (initModule && initModule.init) {
                    console.log(`  Found initializer at ${initPath}`);
                    initModules.push(initModule.init);
                } else {
                    console.error(`  No initializer found in ${initPath}`);
                }
            } else {
                console.error(`  No initializer file found at ${initPath}`);
            }
        }
    });

    return initModules;
};

const srcPath = path.resolve(__dirname, '../src');
const initModules = loadInitModules(srcPath);

// Local init endpoint
const initPromises = initModules.map((init:IMigration) => 
    init.down()
        .then(init.up)
);

Promise.all(initPromises)
    .then(() => console.log("Database initialized"))
    .catch((err) => {console.error(err);});

