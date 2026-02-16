import "dotenv/config";
import 'esm-hook';

import { initDatabase } from "./migrations/00-init";

export const migrations = [initDatabase];
export const setupMigrations = [initDatabase];
