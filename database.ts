import knex, { Knex } from "knex";
import { dbConfig } from '../../config';
import { memoize } from "ts-functional";

export const database = memoize(() => knex(dbConfig as Knex.Config), {});
