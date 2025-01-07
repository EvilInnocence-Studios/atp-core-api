import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { IInitializer, IMigration } from './database.d';

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

const srcPath = path.resolve(__dirname, '..');
const initModules = loadInitModules(srcPath);

// Initialize all database tables
const initPromises = initModules.map((init:IMigration) => 
    init.down()
        .then(init.up)
);

Promise.all(initPromises)
    // Run the initData function for each initializer in priority order
    // Each initData initializer should wait for the previous one to be done
    .then(() => {
        console.log("Running data initializers");
        return initModules
            .sort((a, b) => a.priority - b.priority)
            .reduce(
                (prevInit, curInit) => prevInit.then(curInit.initData), 
                Promise.resolve()
            );
    })
    .then(() => console.log("Database initialized"))
    .catch((err) => {console.error(err);});

