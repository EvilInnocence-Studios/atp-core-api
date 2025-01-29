import knex, { Knex } from "knex";
import { dbConfig } from '../../config';

console.log(dbConfig);

export const database = () => knex(dbConfig as Knex.Config);
