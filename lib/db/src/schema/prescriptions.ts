import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, boolean } from "drizzle-orm/mysql-core";
import { patientsTable } from "./patients";
import { doctorAppointmentsTable } from "./doctor-appointments";
import { doctorAccountsTable } from "./doctor-accounts";
import { medicalRecordsTable } from "./medical-records";

export const prescriptionStatusValues = ["draft", "completed", "cancelled"] as const;

export const prescriptionsTable = mysqlTable("prescriptions", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  appointmentId: int("appointment_id").references(() => doctorAppointmentsTable.id, { onDelete: "set null" }),
  medicalRecordId: int("medical_record_id").references(() => medicalRecordsTable.id, { onDelete: "set null" }),
  doctorAccountId: int("doctor_account_id").references(() => doctorAccountsTable.id, { onDelete: "set null" }),
  discordMessageId: varchar("discord_message_id", { length: 64 }).unique(),
  discordChannelId: varchar("discord_channel_id", { length: 64 }),
  sourceAuthorName: varchar("source_author_name", { length: 255 }),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  cid: varchar("cid", { length: 64 }),
  age: varchar("age", { length: 32 }),
  sex: varchar("sex", { length: 32 }),
  weight: varchar("weight", { length: 64 }),
  prescriptionDateText: varchar("prescription_date_text", { length: 64 }),
  symptoms: text("symptoms"),
  findings: text("findings"),
  advice: text("advice"),
  followUp: text("follow_up"),
  doctorName: varchar("doctor_name", { length: 255 }),
  signatureText: text("signature_text"),
  sourceAttachmentUrl: text("source_attachment_url"),
  importedFromArchive: boolean("imported_from_archive").notNull().default(false),
  sourceDeletedAt: timestamp("source_deleted_at", { mode: "date" }),
  postedAt: timestamp("posted_at", { mode: "date" }),
  status: mysqlEnum("status", prescriptionStatusValues).notNull().default("draft"),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const prescriptionItemsTable = mysqlTable("prescription_items", {
  id: int("id").autoincrement().primaryKey(),
  prescriptionId: int("prescription_id").notNull().references(() => prescriptionsTable.id, { onDelete: "cascade" }),
  medicineName: varchar("medicine_name", { length: 255 }).notNull(),
  customLabel: varchar("custom_label", { length: 255 }),
  medicineCatalogId: int("medicine_catalog_id"),
  dosageText: varchar("dosage_text", { length: 255 }),
  instructions: text("instructions"),
  priceAmount: int("price_amount").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const prescriptionAttachmentsTable = mysqlTable("prescription_attachments", {
  id: int("id").autoincrement().primaryKey(),
  prescriptionId: int("prescription_id").notNull().references(() => prescriptionsTable.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }),
  sourceUrl: text("source_url").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const prescriptionEventsTable = mysqlTable("prescription_events", {
  id: int("id").autoincrement().primaryKey(),
  prescriptionId: int("prescription_id").notNull().references(() => prescriptionsTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  actorType: varchar("actor_type", { length: 64 }).notNull(),
  actorLabel: varchar("actor_label", { length: 255 }).default("Unknown").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type Prescription = typeof prescriptionsTable.$inferSelect;
