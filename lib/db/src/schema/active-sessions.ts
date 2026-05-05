import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";
import { membersTable } from "./members";

export const activeDutySessionsTable = mysqlTable("active_duty_sessions", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  licenseKey: varchar("license_key", { length: 191 }).notNull().unique(),
  playerName: varchar("player_name", { length: 255 }).notNull(),
  startTime: timestamp("start_time", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type ActiveDutySession = typeof activeDutySessionsTable.$inferSelect;
