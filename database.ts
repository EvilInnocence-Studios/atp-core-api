import knex, { Knex } from "knex";
import { dbConfig } from '../../config';

export const database = () => knex(dbConfig as Knex.Config);
