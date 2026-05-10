import { mysqlTable, int, varchar, text, timestamp, boolean } from "drizzle-orm/mysql-core";

export const priceCatalogTable = mysqlTable("price_catalog", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  amount: int("amount").notNull(),
  requiredRank: varchar("required_rank", { length: 64 }),
  isCustomLabelAllowed: boolean("is_custom_label_allowed").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type PriceCatalogItem = typeof priceCatalogTable.$inferSelect;
