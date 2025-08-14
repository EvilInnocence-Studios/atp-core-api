// 00 - Initialize empty database
import { IMigration } from '../dbMigrations';
import { init as commonInit } from '../../common/migrations/00-init';
import { init as uacInit } from '../../uac/migrations/00-init';

// 01 - Initialize discounts

export const initDatabase:IMigration = {
    name: "init",
    module: "core",
    description: "Initialize the database with common, and uac tables.",
    order: 0,
    up: async () => {
        await uacInit.up();
        await commonInit.up();
    },
    down: async () => {
        await commonInit.down();
        await uacInit.down();
    },
    initData: async () => {
        await uacInit.initData();
        await commonInit.initData();
    }
}