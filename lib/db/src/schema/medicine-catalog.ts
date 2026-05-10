import { mysqlTable, int, varchar, text, timestamp, boolean } from "drizzle-orm/mysql-core";

export const medicineCatalogTable = mysqlTable("medicine_catalog", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  category: varchar("category", { length: 64 }).notNull().default("medicine"),
  dosageForm: varchar("dosage_form", { length: 64 }),
  notes: text("notes"),
  requiredRank: varchar("required_rank", { length: 64 }),
  defaultPrice: int("default_price").notNull().default(0),
  isGenericTemplate: boolean("is_generic_template").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type MedicineCatalogItem = typeof medicineCatalogTable.$inferSelect;
