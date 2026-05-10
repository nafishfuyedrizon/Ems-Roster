import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";

export const documentPrintVersionsTable = mysqlTable("document_print_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentType: varchar("document_type", { length: 64 }).notNull(),
  documentId: int("document_id").notNull(),
  versionNumber: int("version_number").notNull().default(1),
  renderFormat: varchar("render_format", { length: 32 }).notNull().default("svg"),
  directUrl: text("direct_url"),
  externalImageUrl: text("external_image_url"),
  sourceHash: varchar("source_hash", { length: 191 }),
  metadataJson: text("metadata_json"),
  createdBy: varchar("created_by", { length: 255 }).default("Unknown").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type DocumentPrintVersion = typeof documentPrintVersionsTable.$inferSelect;
