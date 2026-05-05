import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, membersTable, qualificationChartTable } from "@workspace/db";
import {
  ListMembersQueryParams,
  CreateMemberBody,
  GetMemberParams,
  UpdateMemberParams,
  UpdateMemberBody,
  DeleteMemberParams,
  GetMemberWeeklyStatsParams,
} from "@workspace/api-zod";
import { dutyLogsTable } from "@workspace/db";
import { logAction } from "../lib/panel-logger";
import { requireAdminRole } from "../lib/admin-auth";
import {
  createQualChartForMember,
  syncQualChartOnRankChange,
  deleteQualChartForMember,
  addLOADaysToQualChart,
} from "./qualification-chart";

const router: IRouter = Router();

const RANK_ORDER = [
  "Director",
  "Deputy Director",
  "Assistant Director",
  "Captain",
  "Lieutenant",
  "Sergeant First Class",
  "Sergeant",
  "Senior Specialist",
  "Specialist",
  "Senior Paramedic",
  "Paramedic",
  "EMT",
  "EMS Student",
];

function rankIndex(rank: string): number {
  const idx = RANK_ORDER.indexOf(rank.trim());
  return idx === -1 ? RANK_ORDER.length : idx;
}

function parseCallSign(callSign: string) {
  const normalized = callSign.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]+)[-\s]?(\d+)$/);

  if (!match) {
    return {
      prefix: normalized,
      number: Number.POSITIVE_INFINITY,
      fallback: normalized,
    };
  }

  return {
    prefix: match[1],
    number: Number.parseInt(match[2], 10),
    fallback: normalized,
  };
}

function compareByRankAndCallSign(
  a: { rank: string; callSign: string; name: string },
  b: { rank: string; callSign: string; name: string }
): number {
  const rankDiff = rankIndex(a.rank) - rankIndex(b.rank);
  if (rankDiff !== 0) return rankDiff;

  const aCallSign = parseCallSign(a.callSign);
  const bCallSign = parseCallSign(b.callSign);
  const prefixDiff = aCallSign.prefix.localeCompare(bCallSign.prefix, undefined, { numeric: true });
  if (prefixDiff !== 0) return prefixDiff;

  const numberDiff = aCallSign.number - bCallSign.number;
  if (numberDiff !== 0) return numberDiff;

  const fallbackDiff = aCallSign.fallback.localeCompare(bCallSign.fallback, undefined, { numeric: true });
  if (fallbackDiff !== 0) return fallbackDiff;

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function buildWeeks(count = 5): { weekStart: string; weekLabel: string }[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const weeks = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sm = pad(start.getMonth() + 1), sd = pad(start.getDate());
    const em = pad(end.getMonth() + 1), ed = pad(end.getDate());
    const ws = `${start.getFullYear()}-${sm}-${sd}`;
    weeks.push({ weekStart: ws, weekLabel: `${sm}/${sd} - ${em}/${ed}` });
  }
  return weeks;
}

// ─── GET /members ─────────────────────────────────────────────────────────────
router.get("/members", async (req, res) => {
  const query = ListMembersQueryParams.parse(req.query);
  const conditions = [];
  if (query.status) conditions.push(eq(membersTable.status, query.status as "Active" | "LOA" | "Vacant" | "Inactive"));
  if (query.rank) conditions.push(eq(membersTable.rank, query.rank));

  const members = conditions.length > 0
    ? await db.select().from(membersTable).where(and(...conditions))
    : await db.select().from(membersTable);

  members.sort(compareByRankAndCallSign);

  res.json(members.map(m => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  })));
});

// ─── POST /members ────────────────────────────────────────────────────────────
router.post("/members", requireAdminRole(["full", "high-command", "ftp-ems"]), async (req, res) => {
  const body = CreateMemberBody.parse(req.body);
  const [inserted] = await db.insert(membersTable).values({
    callSign: body.callSign,
    name: body.name,
    status: body.status as "Active" | "LOA" | "Vacant" | "Inactive",
    rank: body.rank,
    discordId: body.discordId ?? null,
    discordUsername: body.discordUsername ?? null,
    licenseKey: body.licenseKey ?? null,
    joinedAt: body.joinedAt ?? null,
    notes: body.notes ?? null,
    cid: body.cid ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    lastPromotionDate: body.lastPromotionDate ?? null,
    medTrex: body.medTrex ?? "N/A",
    strike: body.strike ?? "N/A",
    highCamNoted: body.highCamNoted ?? null,
    ftoMember: body.ftoMember ?? "N/A",
  }).$returningId();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, inserted.id));
  if (!member) return res.status(500).json({ error: "Member was created but could not be reloaded" });

  const createdBy = (req.headers["x-admin-identity"] as string) || "Unknown";
  await logAction("MEMBER_CREATED", `[${member.callSign}] ${member.name}`, `Rank: ${member.rank} · Status: ${member.status}`, createdBy);

  // Auto-create qualification chart entry
  await createQualChartForMember(member.callSign, member.name, member.rank, member.lastPromotionDate);

  res.status(201).json({
    ...member,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  });
});

// ─── GET /members/:id ─────────────────────────────────────────────────────────
router.get("/members/:id", async (req, res) => {
  const { id } = GetMemberParams.parse({ id: Number(req.params.id) });
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) return res.status(404).json({ error: "Member not found" });
  res.json({
    ...member,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  });
});

// ─── PUT /members/:id ─────────────────────────────────────────────────────────
router.put("/members/:id", requireAdminRole(["full", "high-command", "ftp-ems"]), async (req, res) => {
  const { id } = UpdateMemberParams.parse({ id: Number(req.params.id) });
  const body = UpdateMemberBody.parse(req.body);
  const updateData: Partial<typeof membersTable.$inferInsert> = {};
  if (body.callSign !== undefined)        updateData.callSign = body.callSign;
  if (body.name !== undefined)            updateData.name = body.name;
  if (body.status !== undefined)          updateData.status = body.status as "Active" | "LOA" | "Vacant" | "Inactive";
  if (body.rank !== undefined)            updateData.rank = body.rank;
  if (body.discordId !== undefined)       updateData.discordId = body.discordId;
  if (body.discordUsername !== undefined) updateData.discordUsername = body.discordUsername;
  if (body.licenseKey !== undefined)      updateData.licenseKey = body.licenseKey;
  if (body.joinedAt !== undefined)        updateData.joinedAt = body.joinedAt;
  if (body.notes !== undefined)           updateData.notes = body.notes;
  if (body.cid !== undefined)             updateData.cid = body.cid;
  if (body.phone !== undefined)           updateData.phone = body.phone;
  if (body.email !== undefined)           updateData.email = body.email;
  if (body.lastPromotionDate !== undefined) updateData.lastPromotionDate = body.lastPromotionDate;
  if (body.medTrex !== undefined)         updateData.medTrex = body.medTrex;
  if (body.strike !== undefined)          updateData.strike = body.strike;
  if (body.highCamNoted !== undefined)    updateData.highCamNoted = body.highCamNoted;
  if (body.ftoMember !== undefined)       updateData.ftoMember = body.ftoMember;
  updateData.updatedAt = new Date();

  const [oldMember] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!oldMember) return res.status(404).json({ error: "Member not found" });

  // ─── LOA tracking ────────────────────────────────────────────────────────────
  if (body.status !== undefined && oldMember) {
    const wasLOA = oldMember.status === "LOA";
    const isNowLOA = body.status === "LOA";
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    if (!wasLOA && isNowLOA) {
      // Became LOA → record LOA start date
      updateData.loaStartDate = today;
    } else if (wasLOA && !isNowLOA) {
      // Returning from LOA → calculate days and accumulate
      if (oldMember.loaStartDate) {
        const loaStart = new Date(oldMember.loaStartDate);
        if (!isNaN(loaStart.getTime())) {
          const loaDays = Math.max(0, Math.floor((Date.now() - loaStart.getTime()) / 86400000));
          if (loaDays > 0) {
            await addLOADaysToQualChart(oldMember.callSign, loaDays);
          }
        }
      }
      updateData.loaStartDate = null;
    }
  }

  await db.update(membersTable).set(updateData).where(eq(membersTable.id, id));
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) return res.status(404).json({ error: "Member not found" });

  const changedFields = Object.keys(body).filter(k => (body as any)[k] !== undefined).join(", ");
  const updatedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
  await logAction("MEMBER_UPDATED", `[${member.callSign}] ${member.name}`, `Fields updated: ${changedFields}`, updatedBy);

  // Sync qualification chart
  if (body.rank !== undefined && oldMember && body.rank !== oldMember.rank) {
    // Rank changed → reset qual chart progress
    await syncQualChartOnRankChange(member.callSign, member.name, member.rank);
  } else {
    const oldCS = oldMember?.callSign ?? member.callSign;
    const [qRow] = await db.select().from(qualificationChartTable).where(eq(qualificationChartTable.callSign, oldCS));
    if (qRow) {
      const qualUpdate: Record<string, any> = {};
      if (body.name !== undefined || body.callSign !== undefined) {
        qualUpdate.memberName = member.name;
        qualUpdate.callSign = member.callSign;
      }
      if (body.lastPromotionDate !== undefined) {
        qualUpdate.lastPromotionDate = member.lastPromotionDate ?? null;
        qualUpdate.daysInPresentRank = "0";
        qualUpdate.dutyTimeInRank = "00:00";
      }
      if (Object.keys(qualUpdate).length > 0) {
        await db.update(qualificationChartTable)
          .set(qualUpdate)
          .where(eq(qualificationChartTable.id, qRow.id));
      }
    }
  }

  res.json({
    ...member,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  });
});

// ─── DELETE /members/:id ──────────────────────────────────────────────────────
router.delete("/members/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const { id } = DeleteMemberParams.parse({ id: Number(req.params.id) });
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  await db.delete(membersTable).where(eq(membersTable.id, id));
  if (member) {
    const deletedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
    await logAction("MEMBER_DELETED", `[${member.callSign}] ${member.name}`, `Rank: ${member.rank} · Status: ${member.status}`, deletedBy);
    // Remove qualification chart entry
    await deleteQualChartForMember(member.callSign);
  }
  res.status(204).send();
});

// ─── GET /members/:id/weekly-stats ───────────────────────────────────────────
router.get("/members/:id/weekly-stats", async (req, res) => {
  const { id } = GetMemberWeeklyStatsParams.parse({ id: Number(req.params.id) });
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
  if (!member) return res.status(404).json({ error: "Member not found" });

  const logs = await db.select().from(dutyLogsTable).where(eq(dutyLogsTable.memberId, id));

  let totalMinutes = 0;
  const weeks = buildWeeks(5).map(week => {
    const weekLogs = logs.filter(l => l.weekStart === week.weekStart);
    const eveningMinutes  = weekLogs.filter(l => l.shiftType === "Evening").reduce((s,l) => s + l.durationMinutes, 0);
    const nightMinutes    = weekLogs.filter(l => l.shiftType === "Night").reduce((s,l) => s + l.durationMinutes, 0);
    const midnightMinutes = weekLogs.filter(l => l.shiftType === "Midnight").reduce((s,l) => s + l.durationMinutes, 0);
    const fullMinutes     = weekLogs.filter(l => l.shiftType === "Full").reduce((s,l) => s + l.durationMinutes, 0);
    const wTotal = eveningMinutes + nightMinutes + midnightMinutes + fullMinutes;
    totalMinutes += wTotal;
    return { weekStart: week.weekStart, weekLabel: week.weekLabel, totalMinutes: wTotal, eveningMinutes, nightMinutes, midnightMinutes, fullMinutes };
  });

  res.json({ memberId: member.id, memberName: member.name, callSign: member.callSign, rank: member.rank, totalMinutes, weeks });
});

export default router;
