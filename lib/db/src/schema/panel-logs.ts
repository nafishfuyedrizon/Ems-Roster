import { mysqlTable, int, varchar, text, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";

export const panelLogActionValues = [
  "MEMBER_CREATED",
  "MEMBER_UPDATED",
  "MEMBER_DELETED",
  "DUTY_LOG_CREATED",
  "DUTY_LOG_UPDATED",
  "DUTY_LOG_DELETED",
  "STAFF_ROLES_UPDATED",
  "QUAL_CHART_CREATED",
  "QUAL_CHART_UPDATED",
  "QUAL_CHART_DELETED",
] as const;

export const panelLogsTable = mysqlTable("panel_logs", {
  id: int("id").autoincrement().primaryKey(),
  action: mysqlEnum("action", panelLogActionValues).notNull(),
  targetName: varchar("target_name", { length: 255 }).notNull(),
  details: text("details").notNull(),
  performedBy: varchar("performed_by", { length: 255 }).default("Unknown").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type PanelLog = typeof panelLogsTable.$inferSelect;
