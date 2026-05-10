import { mysqlTable, int, varchar, text, timestamp, boolean, mysqlEnum } from "drizzle-orm/mysql-core";
import { patientsTable } from "./patients";
import { doctorAccountsTable } from "./doctor-accounts";

export const doctorAppointmentStatusValues = ["new", "assigned", "completed", "cancelled"] as const;

export const doctorAppointmentsTable = mysqlTable("doctor_appointments", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patient_id").references(() => patientsTable.id, { onDelete: "set null" }),
  discordMessageId: varchar("discord_message_id", { length: 64 }).notNull().unique(),
  discordChannelId: varchar("discord_channel_id", { length: 64 }).notNull(),
  sourceAuthorName: varchar("source_author_name", { length: 255 }).default("Unknown").notNull(),
  appointmentNumber: varchar("appointment_number", { length: 64 }),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  cid: varchar("cid", { length: 64 }),
  contact: varchar("contact", { length: 64 }),
  gender: varchar("gender", { length: 32 }),
  dateOfBirth: varchar("date_of_birth", { length: 64 }),
  appointmentRawText: text("appointment_raw_text"),
  appointmentTypeLabel: varchar("appointment_type_label", { length: 255 }),
  scheduledAtText: varchar("scheduled_at_text", { length: 128 }),
  postedAt: timestamp("posted_at", { mode: "date" }).notNull(),
  status: mysqlEnum("status", doctorAppointmentStatusValues).notNull().default("new"),
  assignedDoctorAccountId: int("assigned_doctor_account_id").references(() => doctorAccountsTable.id, { onDelete: "set null" }),
  internalNotes: text("internal_notes"),
  sourceDeletedAt: timestamp("source_deleted_at", { mode: "date" }),
  importedFromDiscord: boolean("imported_from_discord").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { mode: "date" }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const doctorAppointmentEventsTable = mysqlTable("doctor_appointment_events", {
  id: int("id").autoincrement().primaryKey(),
  appointmentId: int("appointment_id").notNull().references(() => doctorAppointmentsTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  actorType: varchar("actor_type", { length: 64 }).notNull(),
  actorLabel: varchar("actor_label", { length: 255 }).default("Unknown").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type DoctorAppointment = typeof doctorAppointmentsTable.$inferSelect;
