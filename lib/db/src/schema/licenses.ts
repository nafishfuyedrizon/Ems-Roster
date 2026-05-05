import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const licensesTable = mysqlTable("licenses", {
  id: int("id").autoincrement().primaryKey(),
  licenseKey: varchar("license_key", { length: 191 }).notNull().unique(),
  memberId: int("member_id"),
  memberName: varchar("member_name", { length: 255 }),
  onDutyCount: int("on_duty_count").notNull().default(0),
  offDutyCount: int("off_duty_count").notNull().default(0),
  lastSeen: varchar("last_seen", { length: 64 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const insertLicenseSchema = createInsertSchema(licensesTable).omit({ id: true, createdAt: true });
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type License = typeof licensesTable.$inferSelect;
