// 00 - Initialize empty database
import { IMigration } from '../dbMigrations';

// 01 - Initialize discounts

export const initDatabase:IMigration = {
    name: "init",
    module: "core",
    description: "Initialize the database with the _migrations table.",
    version: 0,
    order: 0,
    up: async () => {
        
    },
    down: async () => {
        
    },
    initData: async () => {
        
    }
}