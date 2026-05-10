import { mysqlTable, int, varchar, text, timestamp, boolean } from "drizzle-orm/mysql-core";
import { membersTable } from "./members";

export const doctorAccountsTable = mysqlTable("doctor_accounts", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }).unique(),
  username: varchar("username", { length: 128 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 255 }).default("Unknown").notNull(),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type DoctorAccount = typeof doctorAccountsTable.$inferSelect;
