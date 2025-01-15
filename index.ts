import "dotenv/config";
import 'esm-hook';

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import {IApiConfig} from "./endpoints";
import fileUpload from 'express-fileupload';
import {types} from 'pg';

const app = express();

// Middleware for parsing JSON
app.use(express.json());

// Middleware for uploading files
app.use(fileUpload());

// Global CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Replace '*' with specific allowed origin(s) in production
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS'); // Allowed methods
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allowed headers
    if (req.method === 'OPTIONS') {
        res.sendStatus(204); // Short-circuit OPTIONS requests
        return;
    }
    next();
});

// Make sure decimal columns are parsed as floats
types.setTypeParser(1700, function(val) {
    return parseFloat(val);
});

// Recursive function to register routes
function registerRoutes(config: IApiConfig, basePath = "") {
    Object.entries(config).forEach(([route, methodsOrSubRoutes]) => {
        const fullPath = `${basePath}/${route}`.replace(/\\/g, "/");

        Object.entries(methodsOrSubRoutes).forEach(([key, handlerOrSubConfig]) => {
            if (["GET", "POST", "PUT", "PATCH", "DELETE"].includes(key.toUpperCase())) {
                const method = key.toLowerCase();
                console.log(`  ${key} ${fullPath}`);
                (app as any)[method](fullPath, handlerOrSubConfig as express.RequestHandler);
            } else if (typeof handlerOrSubConfig === "object") {
                // Handle nested sub-route
                registerRoutes({[key]: handlerOrSubConfig} as IApiConfig, fullPath);
            }
        });
    });
}

// Function to load all top-level endpoint configs
const loadAllApiConfigs = async (): Promise<IApiConfig[]> => {
    const srcPath = path.resolve(__dirname, "..");
    const apiConfigs: IApiConfig[] = [];

    const directories = fs.readdirSync(srcPath, { withFileTypes: true });
    for (const dir of directories) {
        if (dir.isDirectory() && dir.name !== "lib") {
            const modulePath = path.join(srcPath, dir.name);
            console.log(`${dir.name}:`);
            if(fs.existsSync(modulePath)) {
                try {
                    const module:{apiConfig:IApiConfig} = await import(modulePath) as any;
                    if (module.apiConfig) {
                        apiConfigs.push(module.apiConfig);
                    }
                } catch (err) {
                    console.warn(`  Error loading endpoints for ${dir.name}`);
                    console.warn(err);
                }
            } else {
                console.warn(`  <No endpoints>`);
            }
        }
    }

    return apiConfigs;
}

// Initialize the server
(async () => {
    try {
        const apiConfigs = await loadAllApiConfigs();

        // Merge all configs and register routes
        apiConfigs.forEach((config) => registerRoutes(config));

        // Error handler middleware
        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.error(err);
            res.status(500).json({ error: err.message });
        });

        // Start the server
        const PORT = process.env.PORT || 3002;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to load API configs:", err);
        process.exit(1);
    }
})();
