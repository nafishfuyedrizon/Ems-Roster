import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, boolean } from "drizzle-orm/mysql-core";
import { patientsTable } from "./patients";
import { doctorAppointmentsTable } from "./doctor-appointments";
import { doctorAccountsTable } from "./doctor-accounts";

export const mfcCaseStatusValues = ["draft", "completed", "cancelled"] as const;

export const mfcCasesTable = mysqlTable("mfc_cases", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  appointmentId: int("appointment_id").references(() => doctorAppointmentsTable.id, { onDelete: "set null" }),
  doctorAccountId: int("doctor_account_id").references(() => doctorAccountsTable.id, { onDelete: "set null" }),
  discordMessageId: varchar("discord_message_id", { length: 64 }).unique(),
  discordChannelId: varchar("discord_channel_id", { length: 64 }),
  sourceAuthorName: varchar("source_author_name", { length: 255 }),
  sex: varchar("sex", { length: 32 }),
  templateVariant: varchar("template_variant", { length: 32 }).notNull().default("male"),
  applicantName: varchar("applicant_name", { length: 255 }).notNull(),
  cid: varchar("cid", { length: 64 }),
  number: varchar("number", { length: 64 }),
  weight: varchar("weight", { length: 64 }),
  dateOfBirth: varchar("date_of_birth", { length: 64 }),
  mfcReason: text("mfc_reason"),
  examDateText: varchar("exam_date_text", { length: 64 }),
  bloodTest: text("blood_test"),
  bloodResult: varchar("blood_result", { length: 128 }),
  mriTest: text("mri_test"),
  mriResult: varchar("mri_result", { length: 128 }),
  eyeTest: text("eye_test"),
  eyeResult: varchar("eye_result", { length: 128 }),
  finalSummary: text("final_summary"),
  officerName: varchar("officer_name", { length: 255 }),
  officerSignature: text("officer_signature"),
  priceAmount: int("price_amount").notNull().default(3000),
  sourceAttachmentUrl: text("source_attachment_url"),
  importedFromArchive: boolean("imported_from_archive").notNull().default(false),
  sourceDeletedAt: timestamp("source_deleted_at", { mode: "date" }),
  postedAt: timestamp("posted_at", { mode: "date" }),
  status: mysqlEnum("status", mfcCaseStatusValues).notNull().default("draft"),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const mfcCaseEventsTable = mysqlTable("mfc_case_events", {
  id: int("id").autoincrement().primaryKey(),
  mfcCaseId: int("mfc_case_id").notNull().references(() => mfcCasesTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  actorType: varchar("actor_type", { length: 64 }).notNull(),
  actorLabel: varchar("actor_label", { length: 255 }).default("Unknown").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type MfcCase = typeof mfcCasesTable.$inferSelect;
