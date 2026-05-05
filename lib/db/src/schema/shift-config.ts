import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";

export const shiftConfigTable = mysqlTable("shift_config", {
  id: int("id").autoincrement().primaryKey(),
  shiftName: varchar("shift_name", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 128 }),
  startHour: int("start_hour").notNull(),
  endHour: int("end_hour").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type ShiftConfig = typeof shiftConfigTable.$inferSelect;
