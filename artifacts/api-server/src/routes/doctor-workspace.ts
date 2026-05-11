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
const MDT_API_BASE = process.env.MDT_API_BASE?.trim() || "https://mdt-server.legacyrpbd.com";
const MDT_CACHE_TTL_MS = 5 * 60 * 1000;
const MDT_LOGIN_CID = process.env.MDT_LOGIN_CID?.trim() || "";
const MDT_LOGIN_PASSWORD = process.env.MDT_LOGIN_PASSWORD?.trim() || "";
const MDT_ACCESS_TOKEN = process.env.MDT_ACCESS_TOKEN?.trim() || "";
const MDT_REFRESH_TOKEN = process.env.MDT_REFRESH_TOKEN?.trim() || "";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN?.trim() || "";
const DISCORD_MFC_DUMP_CHANNEL_ID = process.env.DISCORD_MFC_DUMP_CHANNEL_ID?.trim() || "1441157572395667768";

type MdtCharacter = {
  character_id: number;
  first_name: string;
  last_name: string;
  gender: number;
  job_name: string | null;
  department_name: string | null;
  position_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  licence_identifier: string | null;
  mugshot: string | null;
};

type MdtVehicle = {
  id?: number;
  name?: string | null;
  plate?: string | null;
  photo?: string | null;
};

type MdtPrior = {
  arrest_id: number;
  incident_id: number;
  time: number | null;
  fine: number | null;
  plea: string | null;
  arrested_date_time: string | null;
  incident_title: string | null;
  charges?: Array<{
    counts: number | null;
    enhancements: string | null;
    label: string | null;
    name: string | null;
    type: string | null;
  }>;
};

let mdtCharactersCache:
  | {
      expiresAt: number;
      rows: MdtCharacter[];
    }
  | null = null;
let mdtAuthCache: {
  accessToken: string;
  refreshToken: string | null;
} | null = MDT_ACCESS_TOKEN
  ? {
      accessToken: MDT_ACCESS_TOKEN,
      refreshToken: MDT_REFRESH_TOKEN || null,
    }
  : null;

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

function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

async function getMdtCharacters() {
  if (mdtCharactersCache && Date.now() < mdtCharactersCache.expiresAt) {
    return mdtCharactersCache.rows;
  }

  const response = await fetch(`${MDT_API_BASE}/public/characters`);
  if (!response.ok) {
    throw new Error(`MDT public character lookup failed with status ${response.status}`);
  }

  const rows = (await response.json()) as MdtCharacter[];
  mdtCharactersCache = {
    expiresAt: Date.now() + MDT_CACHE_TTL_MS,
    rows,
  };
  return rows;
}

function isMissingMedicalConfigTableError(error: unknown) {
  const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "ER_NO_SUCH_TABLE" || /price_catalog|medicine_catalog|doesn't exist/i.test(message);
}

async function getOptionalMfcPrice() {
  try {
    const [row] = await db
      .select({ amount: priceCatalogTable.amount, requiredRank: priceCatalogTable.requiredRank })
      .from(priceCatalogTable)
      .where(eq(priceCatalogTable.name, "MFC"))
      .limit(1);
    return row ?? null;
  } catch (error) {
    if (isMissingMedicalConfigTableError(error)) {
      return null;
    }
    throw error;
  }
}

async function loginToMdt() {
  if (!MDT_LOGIN_CID || !MDT_LOGIN_PASSWORD) {
    throw new Error("MDT authenticated vehicle lookup is not configured.");
  }

  const response = await fetch(`${MDT_API_BASE}/login/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cid: MDT_LOGIN_CID,
      password: MDT_LOGIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`MDT login failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
  };

  if (!payload.accessToken) {
    throw new Error("MDT login did not return an access token.");
  }

  mdtAuthCache = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken ?? null,
  };
  return mdtAuthCache;
}

async function refreshMdtToken() {
  const refreshToken = mdtAuthCache?.refreshToken ?? MDT_REFRESH_TOKEN ?? null;
  if (!refreshToken) {
    return loginToMdt();
  }

  const response = await fetch(`${MDT_API_BASE}/login/refresh-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    return loginToMdt();
  }

  const payload = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
  };

  if (!payload.accessToken) {
    return loginToMdt();
  }

  mdtAuthCache = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken ?? refreshToken,
  };
  return mdtAuthCache;
}

async function getMdtAuthToken() {
  if (mdtAuthCache?.accessToken) return mdtAuthCache.accessToken;
  if (MDT_ACCESS_TOKEN) {
    mdtAuthCache = {
      accessToken: MDT_ACCESS_TOKEN,
      refreshToken: MDT_REFRESH_TOKEN || null,
    };
    return MDT_ACCESS_TOKEN;
  }
  return (await loginToMdt()).accessToken;
}

async function fetchMdtAuthedJson<T>(path: string) {
  let token = await getMdtAuthToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${MDT_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    if ((response.status === 401 || response.status === 403) && attempt === 0) {
      token = (await refreshMdtToken()).accessToken;
      continue;
    }

    throw new Error(`MDT authenticated request failed with status ${response.status}`);
  }

  throw new Error("MDT authenticated request failed.");
}

async function getMdtVehicles(characterId: number) {
  try {
    return await fetchMdtAuthedJson<MdtVehicle[]>(`/characters/${characterId}/vehicles`);
  } catch {
    return [];
  }
}

async function getMdtPriors(characterId: number) {
  const response = await fetch(`${MDT_API_BASE}/public/arrests/suspect/${characterId}`);
  if (!response.ok) {
    throw new Error(`MDT public priors lookup failed with status ${response.status}`);
  }
  return (await response.json()) as MdtPrior[];
}

function patientMatchScore(
  patient: typeof patientsTable.$inferSelect,
  query: string,
) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return 0;

  const name = normalizeSearchValue(patient.name);
  const cid = normalizeSearchValue(patient.cid);
  const phone = normalizeSearchValue(patient.phone);

  if (cid === normalizedQuery) return 400;
  if (name === normalizedQuery) return 320;
  if (cid.startsWith(normalizedQuery)) return 260;
  if (name.startsWith(normalizedQuery)) return 220;
  if (phone.startsWith(normalizedQuery)) return 180;
  if (name.includes(normalizedQuery)) return 140;
  if (cid.includes(normalizedQuery)) return 120;
  if (phone.includes(normalizedQuery)) return 80;
  return 0;
}

function mdtCharacterMatchScore(character: MdtCharacter, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return 0;

  const cid = normalizeSearchValue(character.character_id);
  const firstName = normalizeSearchValue(character.first_name);
  const lastName = normalizeSearchValue(character.last_name);
  const fullName = `${firstName} ${lastName}`.trim();
  const phone = normalizeSearchValue(character.phone_number);
  const department = normalizeSearchValue(character.department_name);
  const position = normalizeSearchValue(character.position_name);

  if (cid === normalizedQuery) return 420;
  if (fullName === normalizedQuery) return 340;
  if (firstName === normalizedQuery || lastName === normalizedQuery) return 300;
  if (cid.startsWith(normalizedQuery)) return 260;
  if (fullName.startsWith(normalizedQuery)) return 220;
  if (phone.startsWith(normalizedQuery)) return 180;
  if (fullName.includes(normalizedQuery)) return 150;
  if (department.includes(normalizedQuery)) return 110;
  if (position.includes(normalizedQuery)) return 100;
  if (phone.includes(normalizedQuery)) return 90;
  if (cid.includes(normalizedQuery)) return 80;
  return 0;
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

async function getPatientSearchCard(patient: typeof patientsTable.$inferSelect) {
  const timeline = await getPatientTimeline(patient.id);
  return {
    ...patient,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
    stats: {
      appointments: timeline.filter((item) => item.type === "appointment").length,
      medicalRecords: timeline.filter((item) => item.type === "medical-record").length,
      mfcCases: timeline.filter((item) => item.type === "mfc").length,
      prescriptions: timeline.filter((item) => item.type === "prescription").length,
    },
    latestActivity: timeline[0] ?? null,
    timelinePreview: timeline.slice(0, 4),
  };
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

async function loadDocumentPageSvg(documentType: string, documentId: number, pageNumber: number) {
  if (documentType === "mfc") {
    const [row] = await db.select().from(mfcCasesTable).where(eq(mfcCasesTable.id, documentId)).limit(1);
    if (!row) return null;
    if (pageNumber !== 1 && pageNumber !== 2) return null;
    return renderMfcSvg(row as unknown as Record<string, unknown>, pageNumber as 1 | 2);
  }
  const document = await loadDocumentPayload(documentType, documentId);
  return document?.svg ?? null;
}

const REMOTE_IMAGE_HREF_PATTERN = /(<image\b[^>]*\shref=")(https?:\/\/[^"]+)(")/g;

function inferImageMimeType(contentType: string | null, url: string) {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalized && normalized.startsWith("image/")) return normalized;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith(".png")) return "image/png";
  if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) return "image/jpeg";
  if (lowerUrl.endsWith(".webp")) return "image/webp";
  if (lowerUrl.endsWith(".gif")) return "image/gif";
  if (lowerUrl.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

async function fetchImageAsDataUrl(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Image fetch failed with status ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = inferImageMimeType(response.headers.get("content-type"), url);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function inlineExternalSvgImages(svg: string) {
  const matches = [...svg.matchAll(REMOTE_IMAGE_HREF_PATTERN)];
  if (matches.length === 0) return svg;

  const uniqueUrls = [...new Set(matches.map((match) => match[2]))];
  const replacements = new Map<string, string>();

  await Promise.all(uniqueUrls.map(async (url) => {
    try {
      replacements.set(url, await fetchImageAsDataUrl(url));
    } catch (error) {
      console.warn(`[DOC-RENDER] Failed to inline remote image: ${url}`, error);
    }
  }));

  return svg.replace(REMOTE_IMAGE_HREF_PATTERN, (full, prefix, url, suffix) => {
    const replacement = replacements.get(url);
    return replacement ? `${prefix}${replacement}${suffix}` : full;
  });
}

async function svgToPngBuffer(svg: string) {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const svgWithEmbeddedImages = await inlineExternalSvgImages(svg);
  return sharp(Buffer.from(svgWithEmbeddedImages), { density: 360 })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
    })
    .toBuffer();
}

function buildMfcDiscordMessageContent(row: typeof mfcCasesTable.$inferSelect, session: ReturnType<typeof doctorActor>) {
  const lines = [
    `Name: ${row.applicantName || "Unknown"}`,
    `CID: ${row.cid || "N/A"}`,
    `Completed By: ${session.callSign} - ${session.name}`,
    "Picture:",
  ];
  return lines.join("\n");
}

function decodeDataUrlToBuffer(dataUrl: unknown) {
  const raw = String(dataUrl ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) {
    throw new Error("Invalid Discord image payload.");
  }
  return Buffer.from(match[2], "base64");
}

async function postCompletedMfcToDiscord(
  row: typeof mfcCasesTable.$inferSelect,
  session: ReturnType<typeof doctorActor>,
  clientRenderedImages?: {
    page1ImageDataUrl?: unknown;
    page2ImageDataUrl?: unknown;
  },
) {
  if (!DISCORD_BOT_TOKEN) {
    throw new Error("Discord bot token is missing on the API server.");
  }
  if (!DISCORD_MFC_DUMP_CHANNEL_ID) {
    throw new Error("Discord MFC dump channel is not configured on the API server.");
  }

  const page1Png =
    decodeDataUrlToBuffer(clientRenderedImages?.page1ImageDataUrl) ??
    (await svgToPngBuffer(renderMfcSvg(row as unknown as Record<string, unknown>, 1)));
  const page2Png =
    decodeDataUrlToBuffer(clientRenderedImages?.page2ImageDataUrl) ??
    (await svgToPngBuffer(renderMfcSvg(row as unknown as Record<string, unknown>, 2)));
  const form = new FormData();

  form.append(
    "payload_json",
    JSON.stringify({
      content: buildMfcDiscordMessageContent(row, session),
    }),
  );
  // Keep Discord output simple and predictable: page 1 first, page 2 second.
  form.append("files[0]", new Blob([page1Png], { type: "image/png" }), `mfc-${row.id}-page-1.png`);
  form.append("files[1]", new Blob([page2Png], { type: "image/png" }), `mfc-${row.id}-page-2.png`);

  const response = await fetch(`https://discord.com/api/v10/channels/${DISCORD_MFC_DUMP_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord MFC post failed with status ${response.status}: ${text.slice(0, 220)}`);
  }

  const json = await response.json() as { id?: string; channel_id?: string };
  return {
    discordMessageId: json.id ?? null,
    discordChannelId: json.channel_id ?? DISCORD_MFC_DUMP_CHANNEL_ID,
  };
}

function errorDetails(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const causeMessage =
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    (error as { cause?: unknown }).cause instanceof Error
      ? (error as { cause: Error }).cause.message
      : "";
  return [message, causeMessage].filter(Boolean).join(" | ");
}

function isMissingMfcDiscordColumnError(error: unknown) {
  const details = errorDetails(error);
  return /ER_BAD_FIELD_ERROR|Unknown column|source_author_name|posted_at|discord_channel_id/i.test(details);
}

async function persistCompletedMfcState(
  id: number,
  completedAt: Date,
  session: ReturnType<typeof doctorActor>,
  posted:
    | {
        discordMessageId: string | null;
        discordChannelId: string;
      }
    | null,
) {
  const attempts: Array<Partial<typeof mfcCasesTable.$inferInsert>> = [
    {
      status: "completed",
      completedAt,
      updatedAt: completedAt,
      ...(posted?.discordMessageId
        ? {
            discordMessageId: posted.discordMessageId,
            discordChannelId: posted.discordChannelId,
            sourceAuthorName: session.name,
            postedAt: completedAt,
          }
        : {}),
    },
    {
      status: "completed",
      completedAt,
      updatedAt: completedAt,
      ...(posted?.discordMessageId
        ? {
            discordMessageId: posted.discordMessageId,
            discordChannelId: posted.discordChannelId,
          }
        : {}),
    },
    {
      status: "completed",
      completedAt,
      updatedAt: completedAt,
      ...(posted?.discordMessageId
        ? {
            discordMessageId: posted.discordMessageId,
          }
        : {}),
    },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      await db.update(mfcCasesTable).set(attempt).where(eq(mfcCasesTable.id, id));
      return;
    } catch (error) {
      lastError = error;
      if (!isMissingMfcDiscordColumnError(error)) {
        throw error;
      }
    }
  }

  if (lastError) throw lastError;
}

function isMissingPrintVersionTableError(error: unknown) {
  const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "ER_NO_SUCH_TABLE" || /document_print_versions|doesn't exist/i.test(message);
}

function buildDocumentImageUrl(req: import("express").Request, documentType: string, documentId: number) {
  return buildAbsoluteUrl(req, `/api/documents/${documentType}/${documentId}/image.png`);
}

function buildDocumentPageImageUrls(req: import("express").Request, documentType: string, documentId: number) {
  if (documentType !== "mfc") return [];
  return [1, 2].map((page) => ({
    page,
    url: buildAbsoluteUrl(req, `/api/documents/${documentType}/${documentId}/page/${page}.png`),
  }));
}

async function createPrintVersion(req: import("express").Request, documentType: string, documentId: number) {
  const session = doctorActor(req);
  const document = await loadDocumentPayload(documentType, documentId);
  if (!document) return null;

  try {
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

    const directUrl = buildAbsoluteUrl(req, `/api/print-versions/${inserted.id}/image.png`);
    await db.update(documentPrintVersionsTable).set({ directUrl }).where(eq(documentPrintVersionsTable.id, inserted.id));
    return {
      id: inserted.id,
      directUrl,
      externalImageUrl: req.body?.externalImageUrl ?? null,
      versionNumber,
      persisted: true,
      pageLinks: buildDocumentPageImageUrls(req, documentType, documentId),
    };
  } catch (error) {
    if (!isMissingPrintVersionTableError(error)) {
      throw error;
    }

    const directUrl = buildDocumentImageUrl(req, documentType, documentId);
    return {
      id: null,
      directUrl,
      externalImageUrl: req.body?.externalImageUrl ?? null,
      versionNumber: 1,
      persisted: false,
      pageLinks: buildDocumentPageImageUrls(req, documentType, documentId),
    };
  }
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

router.get("/mdt/characters/search", requireDoctorAuth, async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    return res.json({ query: "", results: [] });
  }

  const mdtCharacters = await getMdtCharacters();
  const ranked = mdtCharacters
    .map((character) => ({ character, score: mdtCharacterMatchScore(character, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.character.character_id - b.character.character_id)
    .slice(0, 8);

  const candidateCids = ranked.map((entry) => String(entry.character.character_id));
  const linkedPatients = candidateCids.length > 0
    ? await db.select().from(patientsTable).where(inArray(patientsTable.cid, candidateCids))
    : [];

  const linkedPatientByCid = new Map(linkedPatients.map((patient) => [String(patient.cid ?? ""), patient]));
  const results = await Promise.all(
    ranked.map(async ({ character }) => {
      const linkedPatient = linkedPatientByCid.get(String(character.character_id)) ?? null;
      const workspaceCard = linkedPatient ? await getPatientSearchCard(linkedPatient) : null;
      return {
        characterId: character.character_id,
        name: `${character.first_name} ${character.last_name}`.trim(),
        firstName: character.first_name,
        lastName: character.last_name,
        cid: String(character.character_id),
        gender: character.gender === 1 ? "Female" : "Male",
        phone: character.phone_number,
        dateOfBirth: character.date_of_birth,
        jobName: character.job_name,
        departmentName: character.department_name,
        positionName: character.position_name,
        licenceIdentifier: character.licence_identifier,
        mugshot: character.mugshot,
        workspacePatientId: linkedPatient?.id ?? null,
        workspaceCard,
      };
    }),
  );

  return res.json({ query, results });
});

router.get("/mdt/characters/:id", requireDoctorAuth, async (req, res) => {
  const characterId = Number(req.params.id);
  if (!Number.isFinite(characterId) || characterId <= 0) {
    return res.status(400).json({ error: "Invalid character id." });
  }

  const characters = await getMdtCharacters();
  const character = characters.find((row) => row.character_id === characterId);
  if (!character) {
    return res.status(404).json({ error: "MDT character not found." });
  }

  const [priors, vehicles] = await Promise.all([
    getMdtPriors(characterId),
    getMdtVehicles(characterId),
  ]);

  return res.json({
    characterId: character.character_id,
    name: `${character.first_name} ${character.last_name}`.trim(),
    firstName: character.first_name,
    lastName: character.last_name,
    cid: String(character.character_id),
    gender: character.gender === 1 ? "Female" : "Male",
    phone: character.phone_number,
    dateOfBirth: character.date_of_birth,
    jobName: character.job_name,
    departmentName: character.department_name,
    positionName: character.position_name,
    licenceIdentifier: character.licence_identifier,
    mugshot: character.mugshot,
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id ?? null,
      name: vehicle.name ?? "Unknown vehicle",
      plate: vehicle.plate ?? null,
      photo: vehicle.photo ?? null,
    })),
    priors: priors.map((prior) => ({
      arrestId: prior.arrest_id,
      incidentId: prior.incident_id,
      title: prior.incident_title ?? `Arrest ${prior.arrest_id}`,
      arrestedAt: prior.arrested_date_time,
      time: prior.time,
      fine: prior.fine,
      plea: prior.plea,
      charges: (prior.charges ?? []).map((charge) => ({
        label: charge.label,
        name: charge.name,
        type: charge.type,
        counts: charge.counts,
        enhancements: charge.enhancements,
      })),
    })),
  });
});

router.get("/patients/search", requireDoctorAuth, async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) {
    return res.json({ query: "", results: [] });
  }

  const rows = await db.select().from(patientsTable).orderBy(desc(patientsTable.updatedAt));
  const ranked = rows
    .map((patient) => ({ patient, score: patientMatchScore(patient, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.patient.updatedAt.getTime() - a.patient.updatedAt.getTime())
    .slice(0, 8);

  const results = await Promise.all(ranked.map((entry) => getPatientSearchCard(entry.patient)));
  return res.json({ query, results });
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
  try {
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

    const mfcPrice = await getOptionalMfcPrice();
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
      officerSignature: req.body?.officerSignature ?? session.name,
      sourceAttachmentUrl: req.body?.sourceAttachmentUrl ?? null,
      priceAmount: mfcPrice?.amount ?? 3000,
      status: "draft",
    }).$returningId();
    try {
      await createMfcEvent(inserted.id, "created", "doctor", session.callSign, "MFC case created");
    } catch (eventError) {
      console.warn("[DOCTOR-MFC] Event log write failed during create; continuing.", eventError);
    }
    return res.status(201).json({ id: inserted.id });
  } catch (error) {
    console.error("[DOCTOR-MFC] Failed to create MFC case:", error);
    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Failed to create MFC case";
    return res.status(500).json({ error: message });
  }
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
  const keys = ["sex", "templateVariant", "applicantName", "cid", "number", "weight", "dateOfBirth", "mfcReason", "examDateText", "bloodTest", "bloodResult", "mriTest", "mriResult", "eyeTest", "eyeResult", "finalSummary", "officerName", "officerSignature", "sourceAttachmentUrl", "status"] as const;
  for (const key of keys) {
    if (req.body?.[key] !== undefined) (updateData as any)[key] = req.body[key];
  }
  await db.update(mfcCasesTable).set(updateData).where(eq(mfcCasesTable.id, id));
  try {
    await createMfcEvent(id, "updated", "doctor", session.callSign, "MFC case updated");
  } catch (eventError) {
    console.warn("[DOCTOR-MFC] Event log write failed during update; continuing.", eventError);
  }
  return res.status(204).send();
});

router.post("/mfc-cases/:id/complete", requireDoctorAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const session = doctorActor(req);
    const [existing] = await db.select().from(mfcCasesTable).where(eq(mfcCasesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "MFC case not found." });

    const completedAt = new Date();
    let posted:
      | {
          discordMessageId: string | null;
          discordChannelId: string;
        }
      | null = null;

    if (!existing.discordMessageId) {
      const previewRow = {
        ...existing,
        status: "completed",
        completedAt,
        updatedAt: completedAt,
        sourceAuthorName: session.name,
      } satisfies typeof mfcCasesTable.$inferSelect;

      try {
        posted = await postCompletedMfcToDiscord(previewRow, session, req.body);
      } catch (discordError) {
        console.warn("[DOCTOR-MFC] Discord post failed during complete.", discordError);
        const message = discordError instanceof Error && discordError.message.trim()
          ? discordError.message.trim()
          : "Discord post failed during MFC completion.";
        return res.status(502).json({ error: message });
      }
    }

    await persistCompletedMfcState(id, completedAt, session, posted);

    try {
      await createMfcEvent(id, "completed", "doctor", session.callSign, "MFC case completed");
    } catch (eventError) {
      console.warn("[DOCTOR-MFC] Event log write failed during complete; continuing.", eventError);
    }
    return res.status(204).send();
  } catch (error) {
    console.error("[DOCTOR-MFC] Complete route failed.", error);
    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Could not complete this MFC case.";
    return res.status(500).json({ error: message });
  }
});

router.post("/mfc-cases/:id/post-to-discord", requireDoctorAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const session = doctorActor(req);
    const [existing] = await db.select().from(mfcCasesTable).where(eq(mfcCasesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "MFC case not found." });
    if (existing.discordMessageId) {
      return res.status(409).json({ error: "This MFC case is already posted to Discord." });
    }

    const postedAt = new Date();
    const previewRow = {
      ...existing,
      status: "completed",
      completedAt: existing.completedAt ?? postedAt,
      updatedAt: postedAt,
      sourceAuthorName: session.name,
    } satisfies typeof mfcCasesTable.$inferSelect;

    let posted:
      | {
          discordMessageId: string | null;
          discordChannelId: string;
        }
      | null = null;
    try {
      posted = await postCompletedMfcToDiscord(previewRow, session, req.body);
    } catch (discordError) {
      console.warn("[DOCTOR-MFC] Discord post failed during retry.", discordError);
      const message = discordError instanceof Error && discordError.message.trim()
        ? discordError.message.trim()
        : "Discord post failed during retry.";
      return res.status(502).json({ error: message });
    }

    await persistCompletedMfcState(
      id,
      existing.completedAt ?? postedAt,
      session,
      posted,
    );

    return res.status(204).send();
  } catch (error) {
    console.error("[DOCTOR-MFC] Post-to-Discord route failed.", error);
    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Could not post this MFC case to Discord.";
    return res.status(500).json({ error: message });
  }
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
  try {
    const documentType = String(req.params.type);
    const documentId = Number(req.params.id);
    const created = await createPrintVersion(req, documentType, documentId);
    if (!created) return res.status(404).json({ error: "Printable document not found." });
    return res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Failed to generate print version";
    return res.status(500).json({ error: message });
  }
});

router.get("/documents/:type/:id/print-versions", requireDoctorAuth, async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  try {
    const rows = await db
      .select()
      .from(documentPrintVersionsTable)
      .where(and(eq(documentPrintVersionsTable.documentType, documentType), eq(documentPrintVersionsTable.documentId, documentId)))
      .orderBy(desc(documentPrintVersionsTable.versionNumber));
    return res.json(rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      pageLinks: documentType === "mfc"
        ? [1, 2].map((page) => ({
            page,
            url: buildAbsoluteUrl(req, `/api/documents/${documentType}/${documentId}/page/${page}.png`),
          }))
        : [],
    })));
  } catch (error) {
    if (isMissingPrintVersionTableError(error)) {
      return res.json([]);
    }
    throw error;
  }
});

router.post("/print-versions/:id/regenerate", requireDoctorAuth, async (req, res) => {
  try {
    const versionId = Number(req.params.id);
    const [existing] = await db.select().from(documentPrintVersionsTable).where(eq(documentPrintVersionsTable.id, versionId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Print version not found." });
    const created = await createPrintVersion(req, existing.documentType, existing.documentId);
    if (!created) return res.status(404).json({ error: "Printable document not found." });
    return res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Failed to regenerate print version";
    return res.status(500).json({ error: message });
  }
});

router.get("/documents/:type/:id/image.svg", async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  const document = await loadDocumentPayload(documentType, documentId);
  if (!document) return res.status(404).send("Not found");

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename=\"${documentType}-${documentId}.svg\"`);
  }
  return res.send(document.svg);
});

router.get("/documents/:type/:id/image.png", async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  const document = await loadDocumentPayload(documentType, documentId);
  if (!document) return res.status(404).send("Not found");

  const png = await svgToPngBuffer(document.svg);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="${documentType}-${documentId}.png"`);
  }
  return res.send(png);
});

router.get("/documents/:type/:id/template.docx", async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  if (documentType !== "mfc") return res.status(404).send("Not found");
  const document = await loadDocumentPayload(documentType, documentId);
  if (!document) return res.status(404).send("Not found");

  const docx = await generateMfcTemplateDocx(document.row as Record<string, unknown>);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="${documentType}-${documentId}-template.docx"`);
  }
  return res.send(docx);
});

router.post("/documents/:type/:id/template.docx", requireDoctorAuth, async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  if (documentType !== "mfc") return res.status(404).send("Not found");
  const document = await loadDocumentPayload(documentType, documentId);
  if (!document) return res.status(404).send("Not found");

  const docxInput = {
    ...(document.row as Record<string, unknown>),
    ...(req.body && typeof req.body === "object" ? req.body : {}),
  };

  const docx = await generateMfcTemplateDocx(docxInput);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Cache-Control", "no-store");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="${documentType}-${documentId}-template.docx"`);
  }
  return res.send(docx);
});

router.get("/documents/:type/:id/page/:page.png", async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  const pageNumber = Number(req.params.page);
  const svg = await loadDocumentPageSvg(documentType, documentId, pageNumber);
  if (!svg) return res.status(404).send("Not found");

  const png = await svgToPngBuffer(svg);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="${documentType}-${documentId}-page-${pageNumber}.png"`);
  }
  return res.send(png);
});

router.get("/documents/:type/:id/page/:page", async (req, res) => {
  const documentType = String(req.params.type);
  const documentId = Number(req.params.id);
  const pageNumber = Number(req.params.page);
  const svg = await loadDocumentPageSvg(documentType, documentId, pageNumber);
  if (!svg) return res.status(404).send("Not found");

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename=\"${documentType}-${documentId}-page-${pageNumber}.svg\"`);
  }
  return res.send(svg);
});

router.get("/print-versions/:id/image.svg", async (req, res) => {
  const versionId = Number(req.params.id);
  const [version] = await db.select().from(documentPrintVersionsTable).where(eq(documentPrintVersionsTable.id, versionId)).limit(1);
  if (!version) return res.status(404).send("Not found");
  const document = await loadDocumentPayload(version.documentType, version.documentId);
  if (!document) return res.status(404).send("Not found");

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename=\"${version.documentType}-${version.documentId}-version-${version.versionNumber}.svg\"`);
  }
  return res.send(document.svg);
});

router.get("/print-versions/:id/image.png", async (req, res) => {
  const versionId = Number(req.params.id);
  const [version] = await db.select().from(documentPrintVersionsTable).where(eq(documentPrintVersionsTable.id, versionId)).limit(1);
  if (!version) return res.status(404).send("Not found");
  const document = await loadDocumentPayload(version.documentType, version.documentId);
  if (!document) return res.status(404).send("Not found");

  const png = await svgToPngBuffer(document.svg);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="${version.documentType}-${version.documentId}-version-${version.versionNumber}.png"`);
  }
  return res.send(png);
});

export default router;
