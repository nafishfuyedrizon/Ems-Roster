import { mysqlTable, int, varchar, text, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";

export const shiftTypeValues = ["Evening", "Night", "Midnight", "Full"] as const;

export const dutyLogsTable = mysqlTable("duty_logs", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  weekStart: varchar("week_start", { length: 10 }).notNull(),
  shiftType: mysqlEnum("shift_type", shiftTypeValues).notNull(),
  durationMinutes: int("duration_minutes").notNull(),
  logDate: varchar("log_date", { length: 10 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const insertDutyLogSchema = createInsertSchema(dutyLogsTable).omit({ id: true, createdAt: true });
export type InsertDutyLog = z.infer<typeof insertDutyLogSchema>;
export type DutyLog = typeof dutyLogsTable.$inferSelect;
