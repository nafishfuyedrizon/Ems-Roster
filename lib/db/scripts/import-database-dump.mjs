import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Cannot import database dump.");
  process.exit(1);
}

const dumpPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(__dirname, "../../../data/database_dump.json");

if (!fs.existsSync(dumpPath)) {
  console.error(`Database dump not found: ${dumpPath}`);
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));

const tableOrder = [
  "members",
  "licenses",
  "shift_config",
  "qualification_chart",
  "ex_ems",
  "panel_logs",
  "duty_logs",
  "staff_roles",
];

const truncateOrder = [
  "active_duty_sessions",
  "staff_roles",
  "duty_logs",
  "panel_logs",
  "qualification_chart",
  "licenses",
  "shift_config",
  "ex_ems",
  "members",
];

function qIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `\`${name}\``;
}

function normalizeValue(value) {
  return value === undefined ? null : value;
}

async function insertRows(client, tableName, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`- ${tableName}: 0 rows`);
    return;
  }

  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  const batchSize = 500;
  let inserted = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = [];
    const groups = [];
    for (const row of batch) {
      const placeholders = [];
      for (const col of columns) {
        values.push(normalizeValue(row[col]));
        placeholders.push("?");
      }
      groups.push(`(${placeholders.join(", ")})`);
    }

    const sql = `INSERT INTO ${qIdent(tableName)} (${columns.map(qIdent).join(", ")}) VALUES ${groups.join(", ")}`;
    await client.execute(sql, values);
    inserted += batch.length;
  }

  console.log(`- ${tableName}: ${inserted} rows`);
}

const client = await mysql.createConnection(databaseUrl);

try {
  console.log("Connecting to MySQL / MariaDB...");
  await client.query("SET FOREIGN_KEY_CHECKS = 0");

  console.log("Resetting existing tables...");
  for (const tableName of truncateOrder) {
    await client.query(`DELETE FROM ${qIdent(tableName)}`);
    await client.query(`ALTER TABLE ${qIdent(tableName)} AUTO_INCREMENT = 1`);
  }

  console.log(`Importing ${dumpPath} ...`);
  await client.beginTransaction();
  for (const tableName of tableOrder) {
    await insertRows(client, tableName, dump[tableName] ?? []);
  }
  const skippedActiveSessions = Array.isArray(dump.active_duty_sessions) ? dump.active_duty_sessions.length : 0;
  console.log(`- active_duty_sessions: skipped ${skippedActiveSessions} rows (rebuilt from live timestamps on startup)`);
  await client.commit();

  console.log("Database import complete.");
} catch (error) {
  try { await client.rollback(); } catch {}
  console.error("Database import failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  try { await client.query("SET FOREIGN_KEY_CHECKS = 1"); } catch {}
  await client.end();
}
