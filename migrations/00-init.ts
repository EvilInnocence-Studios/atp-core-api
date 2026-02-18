// 00 - Initialize empty database
import { database } from '../database';
import { IMigration } from '../dbMigrations';

const db = database();

export const initDatabase:IMigration = {
    name: "init",
    module: "core",
    description: "Initialize the core database functionality",
    version: "1.0.0",
    order: 0,
    up: async () => 
        db.schema
            .createTable("_migrations", (table) => {
                table.string("module").notNullable();
                table.string("version").notNullable();
                table.primary(["module"]);
            }),
    down: async () => 
        db.schema
            .dropTable("_migrations"),
    initData: async () => {
        // No data to initialize
    }
}