import knex, { Knex } from "knex";
import { dbConfig } from '../../config';

type Env = keyof typeof dbConfig; // Ensures valid keys only
const env: Env = (process.env.ENV as Env) || "local";
const config = dbConfig[env] as Knex.Config;
export const database = () => knex(config);
