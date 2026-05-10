import { mysqlTable, int, varchar, text, timestamp, boolean } from "drizzle-orm/mysql-core";
import { patientsTable } from "./patients";
import { doctorAccountsTable } from "./doctor-accounts";

export const medicalRecordsTable = mysqlTable("medical_records", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  discordMessageId: varchar("discord_message_id", { length: 64 }).unique(),
  discordChannelId: varchar("discord_channel_id", { length: 64 }),
  sourceAuthorName: varchar("source_author_name", { length: 255 }).default("Unknown").notNull(),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  cid: varchar("cid", { length: 64 }),
  phone: varchar("phone", { length: 64 }),
  injuryDetails: text("injury_details"),
  treatmentDetails: text("treatment_details"),
  recordDateText: varchar("record_date_text", { length: 64 }),
  doneByText: varchar("done_by_text", { length: 255 }),
  internalNotes: text("internal_notes"),
  assignedDoctorAccountId: int("assigned_doctor_account_id").references(() => doctorAccountsTable.id, { onDelete: "set null" }),
  importedFromDiscord: boolean("imported_from_discord").notNull().default(true),
  sourceDeletedAt: timestamp("source_deleted_at", { mode: "date" }),
  postedAt: timestamp("posted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const medicalRecordAttachmentsTable = mysqlTable("medical_record_attachments", {
  id: int("id").autoincrement().primaryKey(),
  medicalRecordId: int("medical_record_id").notNull().references(() => medicalRecordsTable.id, { onDelete: "cascade" }),
  attachmentType: varchar("attachment_type", { length: 32 }).notNull().default("image"),
  fileName: varchar("file_name", { length: 255 }),
  sourceUrl: text("source_url").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type MedicalRecord = typeof medicalRecordsTable.$inferSelect;
