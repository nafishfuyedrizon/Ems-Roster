import { mysqlTable, int, boolean, timestamp } from "drizzle-orm/mysql-core";
import { membersTable } from "./members";

export const staffRolesTable = mysqlTable("staff_roles", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }).unique(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  isSeniorStaff: boolean("is_senior_staff").notNull().default(false),
  isStaff: boolean("is_staff").notNull().default(false),
  isFTB: boolean("is_ftb").notNull().default(false),
  hasQCAccess: boolean("has_qc_access").notNull().default(false),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type StaffRole = typeof staffRolesTable.$inferSelect;
