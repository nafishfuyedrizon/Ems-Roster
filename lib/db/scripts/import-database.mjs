import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const dumpPath = process.env.DATABASE_DUMP_PATH
  ? path.resolve(process.env.DATABASE_DUMP_PATH)
  : path.join(repoRoot, "database_dump.json");

if (!process.env.DATABASE_URL) {
  console.error("[DB IMPORT] DATABASE_URL is missing.");
  process.exit(1);
}

if (!fs.existsSync(dumpPath)) {
  console.log(`[DB IMPORT] No database_dump.json found at ${dumpPath}; skipping seed import.`);
  process.exit(0);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));

const TABLES = [
  {
    key: "members",
    table: "members",
    columns: [
      "id", "call_sign", "name", "status", "rank", "discord_id", "discord_username",
      "license_key", "joined_at", "notes", "cid", "phone", "email", "last_promotion_date",
      "med_trex", "strike", "high_cam_noted", "fto_member", "loa_start_date",
      "created_at", "updated_at",
    ],
  },
  {
    key: "shift_config",
    table: "shift_config",
    columns: ["id", "shift_name", "display_name", "start_hour", "end_hour", "updated_at"],
  },
  {
    key: "licenses",
    table: "licenses",
    columns: ["id", "license_key", "member_id", "member_name", "on_duty_count", "off_duty_count", "last_seen", "created_at"],
  },
  {
    key: "qualification_chart",
    table: "qualification_chart",
    columns: [
      "id", "call_sign", "member_name", "rank", "min_seniority_days", "days_in_present_rank",
      "min_duty_hours", "min_loa_days", "loa_days_in_rank", "last_promotion_date",
      "duty_time_in_rank", "status", "vote_by_hc", "notes", "sort_order", "updated_at",
    ],
  },
  {
    key: "ex_ems",
    table: "ex_ems",
    columns: [
      "id", "call_sign", "name", "rank", "discord_id", "discord_username", "license_id",
      "exit_status", "proof", "exit_date", "is_fighter", "is_rru", "is_tvu",
      "is_medevac_advanced", "is_medevac_trainee", "notes", "added_by", "created_at",
    ],
  },
  {
    key: "duty_logs",
    table: "duty_logs",
    columns: ["id", "member_id", "week_start", "shift_type", "duration_minutes", "log_date", "notes", "created_at"],
  },
  {
    key: "active_duty_sessions",
    table: "active_duty_sessions",
    columns: ["id", "member_id", "license_key", "player_name", "start_time", "created_at"],
    skipImport: true,
  },
  {
    key: "staff_roles",
    table: "staff_roles",
    columns: ["id", "member_id", "is_super_admin", "is_senior_staff", "is_staff", "is_ftb", "has_qc_access", "updated_at"],
  },
  {
    key: "panel_logs",
    table: "panel_logs",
    columns: ["id", "action", "target_name", "details", "performed_by", "created_at"],
  },
];

function quoteIdent(name) {
  return `\`${name.replaceAll("`", "``")}\``;
}

async function tableExists(client, table) {
  const [rows] = await client.execute(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [table],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function countRows(client, table) {
  const [rows] = await client.query(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`);
  return Number(rows[0]?.count ?? 0);
}

async function insertRows(client, tableDef, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const columns = tableDef.columns;
  const colSql = columns.map(quoteIdent).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${quoteIdent(tableDef.table)} (${colSql}) VALUES (${placeholders})`;

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((col) => row[col] ?? null);
    await client.execute(sql, values);
    inserted++;
  }
  return inserted;
}

async function clearTables(client) {
  await client.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const tableDef of TABLES) {
      await client.query(`DELETE FROM ${quoteIdent(tableDef.table)}`);
      await client.query(`ALTER TABLE ${quoteIdent(tableDef.table)} AUTO_INCREMENT = 1`);
    }
  } finally {
    await client.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}

const client = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const membersExists = await tableExists(client, "members");
  if (!membersExists) {
    throw new Error("The members table does not exist yet. Run drizzle schema push before importing.");
  }

  const existingMembers = await countRows(client, "members");
  const force = process.env.FORCE_DATABASE_IMPORT === "1" || process.argv.includes("--force");

  if (existingMembers > 0 && !force) {
    console.log(`[DB IMPORT] Existing database has ${existingMembers} member(s). Skipping dump import to protect your edits.`);
    console.log("[DB IMPORT] To reset from database_dump.json, run RESET_DATABASE_FROM_DUMP.bat.");
    process.exit(0);
  }

  console.log(force ? "[DB IMPORT] Force reset requested." : "[DB IMPORT] Empty database detected.");
  await clearTables(client);
  await client.beginTransaction();

  for (const tableDef of TABLES) {
    const rows = dump[tableDef.key] ?? [];
    if (tableDef.skipImport) {
      console.log(`[DB IMPORT] ${tableDef.table}: skipped ${Array.isArray(rows) ? rows.length : 0} dump row(s); active sessions rebuild from live timestamps on startup.`);
      continue;
    }
    const inserted = await insertRows(client, tableDef, rows);
    console.log(`[DB IMPORT] ${tableDef.table}: ${inserted} row(s) imported.`);
  }

  await client.commit();
  console.log("[DB IMPORT] Database import complete.");
} catch (err) {
  try { await client.rollback(); } catch {}
  console.error("[DB IMPORT] Failed:", err?.message ?? err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
