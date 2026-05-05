import { mysqlTable, int, varchar, text, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memberStatusValues = ["Active", "LOA", "Vacant", "Inactive"] as const;

export const membersTable = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  callSign: varchar("call_sign", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", memberStatusValues).notNull().default("Active"),
  rank: varchar("rank", { length: 128 }).notNull(),
  discordId: varchar("discord_id", { length: 64 }),
  discordUsername: varchar("discord_username", { length: 255 }),
  licenseKey: varchar("license_key", { length: 191 }),
  joinedAt: varchar("joined_at", { length: 32 }),
  notes: text("notes"),
  cid: varchar("cid", { length: 64 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 255 }),
  lastPromotionDate: varchar("last_promotion_date", { length: 32 }),
  medTrex: varchar("med_trex", { length: 64 }).default("N/A"),
  strike: varchar("strike", { length: 64 }).default("N/A"),
  highCamNoted: varchar("high_cam_noted", { length: 128 }),
  ftoMember: varchar("fto_member", { length: 128 }).default("N/A"),
  loaStartDate: varchar("loa_start_date", { length: 32 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
