import { mysqlTable, int, varchar, text, timestamp, boolean } from "drizzle-orm/mysql-core";

export const patientsTable = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  cid: varchar("cid", { length: 64 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  sex: varchar("sex", { length: 32 }),
  dateOfBirth: varchar("date_of_birth", { length: 64 }),
  weight: varchar("weight", { length: 64 }),
  notes: text("notes"),
  requiresReview: boolean("requires_review").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type Patient = typeof patientsTable.$inferSelect;
