import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  doctorAppointmentsTable,
  doctorAccountsTable,
  documentPrintVersionsTable,
  medicalRecordAttachmentsTable,
  medicalRecordsTable,
  medicineCatalogTable,
  membersTable,
  mfcCasesTable,
  patientsTable,
  prescriptionsTable,
  prescriptionItemsTable,
  priceCatalogTable,
} from "@workspace/db";
import { renderMedicalRecordSvg, renderMfcSvg, renderPrescriptionSvg } from "../lib/document-render";
import { requireDoctorAuth } from "../lib/doctor-auth";
import {
  buildAbsoluteUrl,
  computeSourceHash,
  createAppointmentEvent,
  createMfcEvent,
  createPrescriptionEvent,
  getNextPrintVersionNumber,
  resolveOrCreatePatient,
} from "../lib/medical-helpers";
import { explainRankRequirement, rankMeetsRequirement } from "../lib/medical-permissions";
import { ensureMedicalSeeds } from "../lib/medical-seed";

const router = Router();

function doctorActor(req: import("express").Request) {
  return (req as any).doctorSession as {
    doctorAccountId: number;
    memberId: number;
    username: string;
    callSign: string;
    rank: string;
    name: string;
  };
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

async function getPatientTimeline(patientId: number) {
  const [appointments, records, mfcs, prescriptions] = await Promise.all([
    db.select().from(doctorAppointmentsTable).where(eq(doctorAppointmentsTable.patientId, patientId)),
    db.select().from(medicalRecordsTable).where(eq(medicalRecordsTable.patientId, patientId)),
    db.select().from(mfcCasesTable).where(eq(mfcCasesTable.patientId, patientId)),
    db.select().from(prescriptionsTable).where(eq(prescriptionsTable.patientId, patientId)),
  ]);

  return [
    ...appointments.map((row) => ({ type: "appointment", id: row.id, title: row.appointmentTypeLabel || row.appointmentRawText || "Appointment", occurredAt: toIso(row.postedAt), status: row.status })),
    ...records.map((row) => ({ type: "medical-record", id: row.id, title: row.treatmentDetails || row.injuryDetails || "Medical record", occurredAt: toIso(row.postedAt) ?? row.recordDateText, status: "logged" })),
    ...mfcs.map((row) => ({ type: "mfc", id: row.id, title: row.mfcReason || "Medical Fitness Certificate", occurredAt: row.examDateText || toIso(row.createdAt), status: row.status })),
    ...prescriptions.map((row) => ({ type: "prescription", id: row.id, title: row.advice || row.symptoms || "Prescription", occurredAt: row.prescriptionDateText || toIso(row.createdAt), status: row.status })),
  ].sort((a, b) => String(b.occurredAt ?? "").localeCompare(String(a.occurredAt ?? "")));
}

async function loadDocumentPayload(documentType: string, documentId: number) {
  if (documentType === "mfc") {
    const [row] = await db.select().from(mfcCasesTable).where(eq(mfcCasesTable.id, documentId)).limit(1);
    if (!row) return null;
    return { documentType, row, svg: renderMfcSvg(row as unknown as Record<string, unknown>) };
  }
  if (documentType === "prescription") {
    const [row, items] = await Promise.all([
      db.select().from(prescriptionsTable).where(eq(prescriptionsTable.id, documentId)).limit(1).then((rows) => rows[0] ?? null),
      db.select().from(prescriptionItemsTable).where(eq(prescriptionItemsTable.prescriptionId, documentId)),
    ]);
    if (!row) return null;
    const medicineLines = items.map((item) => `${item.medicineName}${item.customLabel ? ` (${item.customLabel})` : ""} — ${item.dosageText ?? ""} ${item.instructions ?? ""}`.trim());
    return { documentType, row, svg: renderPrescriptionSvg(row as unknown as Record<string, unknown>, medicineLines) };
  }
  if (documentType === "medical-record") {
    const [row] = await db.select().from(medicalRecordsTable).where(eq(medicalRecordsTable.id, documentId)).limit(1);
    if (!row) return null;
    return { documentType, row, svg: renderMedicalRecordSvg(row as unknown as Record<string, unknown>) };
  }
  return null;
}

async function createPrintVersion(req: import("express").Request, documentType: string, documentId: number) {
  const session = doctorActor(req);
  const document = await loadDocumentPayload(documentType, documentId);
  if (!document) return null;

  const versionNumber = await getNextPrintVersionNumber(documentType, documentId);
  const sourceHash = computeSourceHash(document.row as Record<string, unknown>);
  const [inserted] = await db.insert(documentPrintVersionsTable).values({
    documentType,
    documentId,
    versionNumber,
    renderFormat: "svg",
    sourceHash,
    metadataJson: JSON.stringify({ externalImageUrl: req.body?.externalImageUrl ?? null }),
    externalImageUrl: typeof req.body?.externalImageUrl === "string" ? req.body.externalImageUrl : null,
    createdBy: session.callSign,
  }).$returningId();

  const directUrl = buildAbsoluteUrl(req, `/api/print-versions/${inserted.id}/image.svg`);
  await db.update(documentPrintVersionsTable).set({ directUrl }).where(eq(documentPrintVersionsTable.id, inserted.id));
  return { id: inserted.id, directUrl, externalImageUrl: req.body?.externalImageUrl ?? null, versionNumber };
}

router.get("/doctor-dashboard", requireDoctorAuth, async (_req, res) => {
  await ensureMedicalSeeds();
  const [appointments, mfcCases, prescriptions, patients] = await Promise.all([
    db.select().from(doctorAppointmentsTable),
    db.select().from(mfcCasesTable),
    db.select().from(prescriptionsTable),
    db.select().from(patientsTable),
  ]);

  return res.json({
    metrics: {
      patients: patients.length,
      newAppointments: appointments.filter((row) => row.status === "new").length,
      assignedAppointments: appointments.filter((row) => row.status === "assigned").length,
      pendingMfc: mfcCases.filter((row) => row.status === "draft").length,
      pendingPrescriptions: prescriptions.filter((row) => row.status === "draft").length,
    },
    recentAppointments: appointments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5),
    recentPatients: patients.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5),
  });
});

router.get("/doctor-calendar", requireDoctorAuth, async (_req, res) => {
  const rows = await db
    .select({
      id: doctorAppointmentsTable.id,
      patientName: doctorAppointmentsTable.patientName,
      appointmentTypeLabel: doctorAppointmentsTable.appointmentTypeLabel,
      scheduledAtText: doctorAppointmentsTable.scheduledAtText,
      status: doctorAppointmentsTable.status,
      assignedDoctorAccountId: doctorAppointmentsTable.assignedDoctorAccountId,
      postedAt: doctorAppointmentsTable.postedAt,
    })
    .from(doctorAppointmentsTable)
    .orderBy(desc(doctorAppointmentsTable.postedAt));
  return res.json(rows.map((row) => ({ ...row, postedAt: row.postedAt.toISOString() })));
});

router.get("/doctor-appointments", requireDoctorAuth, async (_req, res) => {
  const rows = await db.select().from(doctorAppointmentsTable).orderBy(desc(doctorAppointmentsTable.postedAt));
  return res.json(rows.map((row) => ({ ...row, postedAt: row.postedAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), sourceDeletedAt: toIso(row.sourceDeletedAt), lastSyncedAt: row.lastSyncedAt.toISOString() })));
});

router.get("/doctor-appointments/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [appointment] = await db.select().from(doctorAppointmentsTable).where(eq(doctorAppointmentsTable.id, id)).limit(1);
  if (!appointment) return res.status(404).json({ error: "Appointment not found." });
  return res.json({ ...appointment, postedAt: appointment.postedAt.toISOString(), createdAt: appointment.createdAt.toISOString(), updatedAt: appointment.updatedAt.toISOString() });
});

router.patch("/doctor-appointments/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const session = doctorActor(req);
  const updateData: Partial<typeof doctorAppointmentsTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof req.body?.status === "string") updateData.status = req.body.status as any;
  if (typeof req.body?.internalNotes === "string") updateData.internalNotes = req.body.internalNotes;
  if (typeof req.body?.assignedDoctorAccountId === "number") updateData.assignedDoctorAccountId = req.body.assignedDoctorAccountId;
  if (req.body?.assignedDoctorAccountId === null) updateData.assignedDoctorAccountId = null;

  await db.update(doctorAppointmentsTable).set(updateData).where(eq(doctorAppointmentsTable.id, id));
  await createAppointmentEvent(id, "updated", "doctor", session.callSign, `Fields updated by ${session.callSign}`);
  return res.status(204).send();
});

router.get("/patients", requireDoctorAuth, async (_req, res) => {
  const rows = await db.select().from(patientsTable).orderBy(desc(patientsTable.updatedAt));
  return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })));
});

router.get("/patients/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id)).limit(1);
  if (!patient) return res.status(404).json({ error: "Patient not found." });
  const timeline = await getPatientTimeline(id);
  return res.json({ ...patient, createdAt: patient.createdAt.toISOString(), updatedAt: patient.updatedAt.toISOString(), timeline });
});

router.get("/medical-records", requireDoctorAuth, async (_req, res) => {
  const rows = await db.select().from(medicalRecordsTable).orderBy(desc(medicalRecordsTable.createdAt));
  return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), postedAt: toIso(row.postedAt), sourceDeletedAt: toIso(row.sourceDeletedAt) })));
});

router.get("/medical-records/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [record] = await db.select().from(medicalRecordsTable).where(eq(medicalRecordsTable.id, id)).limit(1);
  if (!record) return res.status(404).json({ error: "Medical record not found." });
  const attachments = await db.select().from(medicalRecordAttachmentsTable).where(eq(medicalRecordAttachmentsTable.medicalRecordId, id));
  return res.json({ ...record, attachments, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), postedAt: toIso(record.postedAt) });
});

router.patch("/medical-records/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const updateData: Partial<typeof medicalRecordsTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof req.body?.internalNotes === "string") updateData.internalNotes = req.body.internalNotes;
  if (typeof req.body?.treatmentDetails === "string") updateData.treatmentDetails = req.body.treatmentDetails;
  await db.update(medicalRecordsTable).set(updateData).where(eq(medicalRecordsTable.id, id));
  return res.status(204).send();
});

router.get("/mfc-cases", requireDoctorAuth, async (_req, res) => {
  const rows = await db.select().from(mfcCasesTable).orderBy(desc(mfcCasesTable.createdAt));
  return res.json(rows.map((row) => ({ ...row, completedAt: toIso(row.completedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })));
});

router.post("/mfc-cases", requireDoctorAuth, async (req, res) => {
  await ensureMedicalSeeds();
  const session = doctorActor(req);
  const patientId = await resolveOrCreatePatient({
    cid: req.body?.cid,
    name: String(req.body?.applicantName ?? ""),
    phone: req.body?.number,
    sex: req.body?.sex,
    dateOfBirth: req.body?.dateOfBirth,
    weight: req.body?.weight,
  });

  const [mfcPrice] = await db.select().from(priceCatalogTable).where(eq(priceCatalogTable.name, "MFC")).limit(1);
  if (mfcPrice && !rankMeetsRequirement(session.rank, mfcPrice.requiredRank)) {
    return res.status(403).json({ error: explainRankRequirement(mfcPrice.requiredRank) ?? "Insufficient medical rank" });
  }

  const [inserted] = await db.insert(mfcCasesTable).values({
    patientId,
    appointmentId: typeof req.body?.appointmentId === "number" ? req.body.appointmentId : null,
    doctorAccountId: session.doctorAccountId,
    sex: req.body?.sex ?? null,
    templateVariant: (req.body?.templateVariant as string) || "male",
    applicantName: String(req.body?.applicantName ?? "Unknown"),
    cid: req.body?.cid ?? null,
    number: req.body?.number ?? null,
    weight: req.body?.weight ?? null,
    dateOfBirth: req.body?.dateOfBirth ?? null,
    mfcReason: req.body?.mfcReason ?? null,
    examDateText: req.body?.examDateText ?? null,
    bloodTest: req.body?.bloodTest ?? null,
    bloodResult: req.body?.bloodResult ?? null,
    mriTest: req.body?.mriTest ?? null,
    mriResult: req.body?.mriResult ?? null,
    eyeTest: req.body?.eyeTest ?? null,
    eyeResult: req.body?.eyeResult ?? null,
    finalSummary: req.body?.finalSummary ?? null,
    officerName: req.body?.officerName ?? session.name,
    officerSignature: req.body?.officerSignature ?? session.callSign,
    priceAmount: mfcPrice?.amount ?? 3000,
    status: "draft",
  }).$returningId();
  await createMfcEvent(inserted.id, "created", "doctor", session.callSign, "MFC case created");
  return res.status(201).json({ id: inserted.id });
});

router.get("/mfc-cases/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(mfcCasesTable).where(eq(mfcCasesTable.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "MFC case not found." });
  return res.json({ ...row, completedAt: toIso(row.completedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
});

router.patch("/mfc-cases/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const session = doctorActor(req);
  const updateData: Partial<typeof mfcCasesTable.$inferInsert> = { updatedAt: new Date() };
  const keys = ["sex", "templateVariant", "applicantName", "cid", "number", "weight", "dateOfBirth", "mfcReason", "examDateText", "bloodTest", "bloodResult", "mriTest", "mriResult", "eyeTest", "eyeResult", "finalSummary", "officerName", "officerSignature", "status"] as const;
  for (const key of keys) {
    if (req.body?.[key] !== undefined) (updateData as any)[key] = req.body[key];
  }
  await db.update(mfcCasesTable).set(updateData).where(eq(mfcCasesTable.id, id));
  await createMfcEvent(id, "updated", "doctor", session.callSign, "MFC case updated");
  return res.status(204).send();
});

router.post("/mfc-cases/:id/complete", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const session = doctorActor(req);
  await db.update(mfcCasesTable).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(mfcCasesTable.id, id));
  await createMfcEvent(id, "completed", "doctor", session.callSign, "MFC case completed");
  return res.status(204).send();
});

router.get("/prescriptions", requireDoctorAuth, async (_req, res) => {
  const rows = await db.select().from(prescriptionsTable).orderBy(desc(prescriptionsTable.createdAt));
  return res.json(rows.map((row) => ({ ...row, completedAt: toIso(row.completedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })));
});

router.post("/prescriptions", requireDoctorAuth, async (req, res) => {
  await ensureMedicalSeeds();
  const session = doctorActor(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  const catalog = await db.select().from(medicineCatalogTable);
  for (const item of items) {
    const catalogEntry = catalog.find((row) => row.id === Number(item.medicineCatalogId));
    if (catalogEntry && !rankMeetsRequirement(session.rank, catalogEntry.requiredRank)) {
      return res.status(403).json({ error: `${catalogEntry.name}: ${explainRankRequirement(catalogEntry.requiredRank)}` });
    }
  }

  const patientId = await resolveOrCreatePatient({
    cid: req.body?.cid,
    name: String(req.body?.patientName ?? ""),
    sex: req.body?.sex,
    weight: req.body?.weight,
  });

  const [inserted] = await db.insert(prescriptionsTable).values({
    patientId,
    appointmentId: typeof req.body?.appointmentId === "number" ? req.body.appointmentId : null,
    medicalRecordId: typeof req.body?.medicalRecordId === "number" ? req.body.medicalRecordId : null,
    doctorAccountId: session.doctorAccountId,
    patientName: String(req.body?.patientName ?? "Unknown"),
    cid: req.body?.cid ?? null,
    age: req.body?.age ?? null,
    sex: req.body?.sex ?? null,
    weight: req.body?.weight ?? null,
    prescriptionDateText: req.body?.prescriptionDateText ?? null,
    symptoms: req.body?.symptoms ?? null,
    findings: req.body?.findings ?? null,
    advice: req.body?.advice ?? null,
    followUp: req.body?.followUp ?? null,
    doctorName: req.body?.doctorName ?? session.name,
    signatureText: req.body?.signatureText ?? session.callSign,
    status: "draft",
  }).$returningId();

  if (items.length > 0) {
    await db.insert(prescriptionItemsTable).values(items.map((item: any) => ({
      prescriptionId: inserted.id,
      medicineName: String(item.medicineName ?? ""),
      customLabel: item.customLabel ?? null,
      medicineCatalogId: typeof item.medicineCatalogId === "number" ? item.medicineCatalogId : null,
      dosageText: item.dosageText ?? null,
      instructions: item.instructions ?? null,
      priceAmount: Number(item.priceAmount ?? 0),
    })));
  }

  await createPrescriptionEvent(inserted.id, "created", "doctor", session.callSign, "Prescription created");
  return res.status(201).json({ id: inserted.id });
});

router.get("/prescriptions/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "Prescription not found." });
  const items = await db.select().from(prescriptionItemsTable).where(eq(prescriptionItemsTable.prescriptionId, id));
  return res.json({ ...row, items, completedAt: toIso(row.completedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
});

router.patch("/prescriptions/:id", requireDoctorAuth, async (req, res) => {
  await ensureMedicalSeeds();
  const id = Number(req.params.id);
  const session = doctorActor(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  const updateData: Partial<typeof prescriptionsTable.$inferInsert> = { updatedAt: new Date() };
  const keys = ["patientName", "cid", "age", "sex", "weight", "prescriptionDateText", "symptoms", "findings", "advice", "followUp", "doctorName", "signatureText", "status"] as const;
  for (const key of keys) {
    if (req.body?.[key] !== undefined) (updateData as any)[key] = req.body[key];
  }
  await db.update(prescriptionsTable).set(updateData).where(eq(prescriptionsTable.id, id));

  if (items) {
    const catalog = await db.select().from(medicineCatalogTable);
    for (const item of items) {
      const catalogEntry = catalog.find((row) => row.id === Number(item.medicineCatalogId));
      if (catalogEntry && !rankMeetsRequirement(session.rank, catalogEntry.requiredRank)) {
        return res.status(403).json({ error: `${catalogEntry.name}: ${explainRankRequirement(catalogEntry.requiredRank)}` });
      }
    }
    await db.delete(prescriptionItemsTable).where(eq(prescriptionItemsTable.prescriptionId, id));
    if (items.length > 0) {
      await db.insert(prescriptionItemsTable).values(items.map((item: any) => ({
        prescriptionId: id,
        medicineName: String(item.medicineName ?? ""),
        customLabel: item.customLabel ?? null,
        medicineCatalogId: typeof item.medicineCatalogId === "number" ? item.medicineCatalogId : null,
        dosageText: item.dosageText ?? null,
        instructions: item.instructions ?? null,
        priceAmount: Number(item.priceAmount ?? 0),
      })));
    }
  }

  await createPrescriptionEvent(id, "updated", "doctor", session.callSign, "Prescription updated");
  return res.status(204).send();
});

router.post("/prescriptions/:id/complete", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const session = doctorActor(req);
  await db.update(prescriptionsTable).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(prescriptionsTable.id, id));
  await createPrescriptionEvent(id, "completed", "doctor", session.callSign, "Prescription completed");
  return res.status(204).send();
});

router.get("/medicines", requireDoctorAuth, async (req, res) => {
  await ensureMedicalSeeds();
  const session = doctorActor(req);
  const rows = await db.select().from(medicineCatalogTable).orderBy(medicineCatalogTable.name);
  return res.json(rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowedForCurrentDoctor: rankMeetsRequirement(session.rank, row.requiredRank),
    restrictionNote: explainRankRequirement(row.requiredRank),
  })));
});

router.post("/medicines", requireDoctorAuth, async (req, res) => {
  const session = doctorActor(req);
  const [inserted] = await db.insert(medicineCatalogTable).values({
    name: String(req.body?.name ?? ""),
    category: String(req.body?.category ?? "medicine"),
    dosageForm: req.body?.dosageForm ?? null,
    notes: req.body?.notes ?? null,
    requiredRank: req.body?.requiredRank ?? null,
    defaultPrice: Number(req.body?.defaultPrice ?? 0),
    isGenericTemplate: Boolean(req.body?.isGenericTemplate),
    isActive: req.body?.isActive !== false,
  }).$returningId();
  return res.status(201).json({ id: inserted.id, createdBy: session.callSign });
});

router.patch("/medicines/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const updateData: Partial<typeof medicineCatalogTable.$inferInsert> = { updatedAt: new Date() };
  const keys = ["name", "category", "dosageForm", "notes", "requiredRank", "defaultPrice", "isGenericTemplate", "isActive"] as const;
  for (const key of keys) if (req.body?.[key] !== undefined) (updateData as any)[key] = req.body[key];
  await db.update(medicineCatalogTable).set(updateData).where(eq(medicineCatalogTable.id, id));
  return res.status(204).send();
});

router.get("/prices", requireDoctorAuth, async (_req, res) => {
  await ensureMedicalSeeds();
  const rows = await db.select().from(priceCatalogTable).orderBy(priceCatalogTable.category, priceCatalogTable.name);
  return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })));
});

router.post("/prices", requireDoctorAuth, async (req, res) => {
  const [inserted] = await db.insert(priceCatalogTable).values({
    category: String(req.body?.category ?? "medicine"),
    name: String(req.body?.name ?? ""),
    description: req.body?.description ?? null,
    amount: Number(req.body?.amount ?? 0),
    requiredRank: req.body?.requiredRank ?? null,
    isCustomLabelAllowed: Boolean(req.body?.isCustomLabelAllowed),
    isActive: req.body?.isActive !== false,
  }).$returningId();
  return res.status(201).json({ id: inserted.id });
});

router.patch("/prices/:id", requireDoctorAuth, async (req, res) => {
  const id = Number(req.params.id);
  const updateData: Partial<typeof priceCatalogTable.$inferInsert> = { updatedAt: new Date() };
  const keys = ["category", "name", "description", "amount", "requiredRank", "isCustomLabelAllowed", "isActive"] as const;
  for (const key of keys) if (req.body?.[key] !== undefined) (updateData as any)[key] = req.body[key];
  await db.update(priceCatalogTable).set(updateData).where(eq(priceCatalogTable.id, id));
  return res.status(204).send();
});

router.post("/documents/:type/:id/print-version", requireDoctorAuth, async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  const created = await createPrintVersion(req, documentType, documentId);
  if (!created) return res.status(404).json({ error: "Printable document not found." });
  return res.status(201).json(created);
});

router.get("/documents/:type/:id/print-versions", requireDoctorAuth, async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  const rows = await db
    .select()
    .from(documentPrintVersionsTable)
    .where(and(eq(documentPrintVersionsTable.documentType, documentType), eq(documentPrintVersionsTable.documentId, documentId)))
    .orderBy(desc(documentPrintVersionsTable.versionNumber));
  return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
});

router.post("/print-versions/:id/regenerate", requireDoctorAuth, async (req, res) => {
  const versionId = Number(req.params.id);
  const [existing] = await db.select().from(documentPrintVersionsTable).where(eq(documentPrintVersionsTable.id, versionId)).limit(1);
  if (!existing) return res.status(404).json({ error: "Print version not found." });
  const created = await createPrintVersion(req, existing.documentType, existing.documentId);
  if (!created) return res.status(404).json({ error: "Printable document not found." });
  return res.status(201).json(created);
});

router.get("/print-versions/:id/image.svg", async (req, res) => {
  const versionId = Number(req.params.id);
  const [version] = await db.select().from(documentPrintVersionsTable).where(eq(documentPrintVersionsTable.id, versionId)).limit(1);
  if (!version) return res.status(404).send("Not found");
  const document = await loadDocumentPayload(version.documentType, version.documentId);
  if (!document) return res.status(404).send("Not found");

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.send(document.svg);
});

export default router;
