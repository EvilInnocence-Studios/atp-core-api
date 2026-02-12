import "dotenv/config";
import 'esm-hook';

import express, { NextFunction, Request, Response } from "express";
import fileUpload from 'express-fileupload';
import { types } from 'pg';
import { apiConfigs } from "../../api.config";
import { IApiConfig } from "./endpoints";
import { initDatabase } from "./migrations/00-init";

const app = express();

// Middleware for parsing JSON
app.use(express.json());

// Middleware for uploading files
app.use(fileUpload());

// Global CORS Middleware
if(process.env.ENV === 'local') {
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
}

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

// Initialize the server
// Merge all configs and register routes
apiConfigs.forEach((config) => {
    console.log("");
    registerRoutes(config)
});

// Error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

export const migrations = [initDatabase];
export const setupMigrations = [initDatabase];

export default app;