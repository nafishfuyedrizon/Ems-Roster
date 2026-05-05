import { mysqlTable, int, varchar, text, boolean, timestamp } from "drizzle-orm/mysql-core";

export const exEmsTable = mysqlTable("ex_ems", {
  id: int("id").autoincrement().primaryKey(),
  callSign: varchar("call_sign", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  rank: varchar("rank", { length: 128 }).notNull(),
  discordId: varchar("discord_id", { length: 64 }),
  discordUsername: varchar("discord_username", { length: 255 }),
  licenseId: varchar("license_id", { length: 191 }),
  exitStatus: varchar("exit_status", { length: 64 }).notNull().default("RESIGNED"),
  proof: text("proof"),
  exitDate: varchar("exit_date", { length: 32 }),
  isFighter: boolean("is_fighter").default(false),
  isRru: boolean("is_rru").default(false),
  isTvu: boolean("is_tvu").default(false),
  isMedevacAdvanced: boolean("is_medevac_advanced").default(false),
  isMedevacTrainee: boolean("is_medevac_trainee").default(false),
  notes: text("notes"),
  addedBy: varchar("added_by", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type ExEms = typeof exEmsTable.$inferSelect;
