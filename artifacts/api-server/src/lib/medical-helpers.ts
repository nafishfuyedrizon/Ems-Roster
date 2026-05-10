import crypto from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  doctorAppointmentEventsTable,
  documentPrintVersionsTable,
  mfcCaseEventsTable,
  patientsTable,
  prescriptionEventsTable,
} from "@workspace/db";

export function normalizeCid(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function resolveOrCreatePatient(input: {
  cid?: string | null;
  name: string;
  phone?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  weight?: string | null;
  notes?: string | null;
}): Promise<number | null> {
  const cid = normalizeCid(input.cid);
  if (!cid) return null;

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.cid, cid)).limit(1);
  if (existing) {
    await db.update(patientsTable).set({
      name: input.name || existing.name,
      phone: input.phone ?? existing.phone,
      sex: input.sex ?? existing.sex,
      dateOfBirth: input.dateOfBirth ?? existing.dateOfBirth,
      weight: input.weight ?? existing.weight,
      notes: input.notes ?? existing.notes,
      updatedAt: new Date(),
    }).where(eq(patientsTable.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db.insert(patientsTable).values({
    cid,
    name: input.name,
    phone: input.phone ?? null,
    sex: input.sex ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    weight: input.weight ?? null,
    notes: input.notes ?? null,
    requiresReview: false,
  }).$returningId();
  return inserted?.id ?? null;
}

export async function createAppointmentEvent(appointmentId: number, eventType: string, actorType: string, actorLabel: string, details?: string) {
  await db.insert(doctorAppointmentEventsTable).values({ appointmentId, eventType, actorType, actorLabel, details: details ?? null });
}

export async function createMfcEvent(mfcCaseId: number, eventType: string, actorType: string, actorLabel: string, details?: string) {
  await db.insert(mfcCaseEventsTable).values({ mfcCaseId, eventType, actorType, actorLabel, details: details ?? null });
}

export async function createPrescriptionEvent(prescriptionId: number, eventType: string, actorType: string, actorLabel: string, details?: string) {
  await db.insert(prescriptionEventsTable).values({ prescriptionId, eventType, actorType, actorLabel, details: details ?? null });
}

export function buildAbsoluteUrl(req: import("express").Request, path: string): string {
  const host = req.get("host") || "localhost";
  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  return `${protocol}://${host}${path}`;
}

export function computeSourceHash(payload: object): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function getNextPrintVersionNumber(documentType: string, documentId: number): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${documentPrintVersionsTable.versionNumber}), 0)` })
    .from(documentPrintVersionsTable)
    .where(and(eq(documentPrintVersionsTable.documentType, documentType), eq(documentPrintVersionsTable.documentId, documentId)));
  return (row?.value ?? 0) + 1;
}
