import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";

export const qualificationChartTable = mysqlTable("qualification_chart", {
  id: int("id").autoincrement().primaryKey(),
  callSign: varchar("call_sign", { length: 64 }).notNull(),
  memberName: varchar("member_name", { length: 255 }),
  rank: varchar("rank", { length: 128 }).notNull(),
  minSeniorityDays: varchar("min_seniority_days", { length: 64 }),
  daysInPresentRank: varchar("days_in_present_rank", { length: 64 }),
  minDutyHours: varchar("min_duty_hours", { length: 64 }),
  minLOADays: varchar("min_loa_days", { length: 64 }),
  loaDaysInRank: int("loa_days_in_rank").default(0),
  lastPromotionDate: varchar("last_promotion_date", { length: 32 }),
  dutyTimeInRank: varchar("duty_time_in_rank", { length: 32 }),
  status: varchar("status", { length: 64 }),
  voteByHC: varchar("vote_by_hc", { length: 64 }),
  notes: text("notes"),
  sortOrder: int("sort_order").default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type QualificationChart = typeof qualificationChartTable.$inferSelect;
