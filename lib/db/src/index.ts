import "./load-env";
import { hydrateDatabaseEnv } from "./load-env";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let poolInstance: mysql.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function ensureDatabaseUrl() {
  const globalDatabaseUrl = (globalThis as Record<string, unknown>)["__EMS_DATABASE_URL__"];
  const databaseUrl =
    process.env.DATABASE_URL ||
    (typeof globalDatabaseUrl === "string" && globalDatabaseUrl.length > 0 ? globalDatabaseUrl : undefined);

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  return databaseUrl;
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
    const value = Reflect.get(ensurePool(), prop, ensurePool());
    return typeof value === "function" ? value.bind(ensurePool()) : value;
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    const value = Reflect.get(ensureDb(), prop, ensureDb());
    return typeof value === "function" ? value.bind(ensureDb()) : value;
  },
});

export * from "./schema";
