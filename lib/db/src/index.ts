import "./load-env";
import { hydrateDatabaseEnv } from "./load-env";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let poolInstance: mysql.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  return process.env.DATABASE_URL;
}

function ensurePool() {
  if (!poolInstance) {
    const databaseUrl = ensureDatabaseUrl();
    poolInstance = mysql.createPool(databaseUrl);
  }

  return poolInstance;
}

function ensureDb() {
  if (!dbInstance) {
    dbInstance = drizzle(ensurePool(), { schema, mode: "default" });
  }

  return dbInstance;
}

void hydrateDatabaseEnv();

export const pool = new Proxy({} as mysql.Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(ensurePool(), prop, receiver);
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    return Reflect.get(ensureDb(), prop, receiver);
  },
});

export * from "./schema";
