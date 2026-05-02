import "dotenv/config";
import 'esm-hook';

import { initDatabase } from "../core/migrations/00-init";

export const migrations = [initDatabase];
export const setupMigrations = [initDatabase];
