import { Router } from "express";
import { db, qualificationChartTable, membersTable, dutyLogsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logAction } from "../lib/panel-logger";
import { requireAdminRole } from "../lib/admin-auth";

const router = Router();

// ─── Rank requirements ────────────────────────────────────────────────────────
export const RANK_REQUIREMENTS: Record<string, { minSeniorityDays: string; minDutyHours: string }> = {
  "Director":             { minSeniorityDays: "Lifetime",     minDutyHours: "Lifetime" },
  "Deputy Director":      { minSeniorityDays: "Lifetime",     minDutyHours: "Lifetime" },
  "Assistant Director":   { minSeniorityDays: "63(9 Weeks)",  minDutyHours: "130" },
  "Captain":              { minSeniorityDays: "56(8 Weeks)",  minDutyHours: "120" },
  "Lieutenant":           { minSeniorityDays: "63(9 Weeks)",  minDutyHours: "120" },
  "Sergeant First Class": { minSeniorityDays: "49(7 Weeks)",  minDutyHours: "110" },
  "Sergeant":             { minSeniorityDays: "49(7 Weeks)",  minDutyHours: "110" },
  "Senior Specialist":    { minSeniorityDays: "42(6 Weeks)",  minDutyHours: "100" },
  "Specialist":           { minSeniorityDays: "42(6 Weeks)",  minDutyHours: "90"  },
  "Senior Paramedic":     { minSeniorityDays: "35(5 Weeks)",  minDutyHours: "80"  },
  "Paramedic":            { minSeniorityDays: "28(4 Weeks)",  minDutyHours: "70"  },
  "EMT":                  { minSeniorityDays: "14(2 Weeks)",  minDutyHours: "40"  },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function parseDateFlexible(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (t === "lifetime") return null;
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) {
    const d = new Date(`${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`);
    if (!isNaN(d.getTime())) return d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function toYYYYMMDD(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function formatHHMM(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// ─── Rank sort order ─────────────────────────────────────────────────────────
const RANK_ORDER = [
  "Director","Deputy Director","Assistant Director","Captain","Lieutenant",
  "Sergeant First Class","Sergeant","Senior Specialist","Specialist",
  "Senior Paramedic","Paramedic","EMT",
];
const rankSortIdx = new Map(RANK_ORDER.map((r,i) => [r,i]));

// ─── Create a qual chart entry for a new member ───────────────────────────────
export async function createQualChartForMember(
  callSign: string,
  name: string,
  rank: string,
  lastPromotionDate?: string | null,
) {
  try {
    const req = RANK_REQUIREMENTS[rank] ?? { minSeniorityDays: "", minDutyHours: "" };
    await db.insert(qualificationChartTable).values({
      callSign,
      memberName: name,
      rank,
      minSeniorityDays: req.minSeniorityDays,
      minDutyHours:     req.minDutyHours,
      lastPromotionDate: lastPromotionDate ?? null,
      daysInPresentRank: null,
      dutyTimeInRank:    null,
      loaDaysInRank:     0,
      status:  null,
      voteByHC: null,
      notes:    null,
      sortOrder: 999,
    });
  } catch (err) {
    console.error("[QualChart createForMember]", err);
  }
}

// ─── Sync when rank changes ───────────────────────────────────────────────────
export async function syncQualChartOnRankChange(
  callSign: string,
  name: string,
  newRank: string,
) {
  try {
    const req = RANK_REQUIREMENTS[newRank] ?? { minSeniorityDays: "", minDutyHours: "" };
    const today = (() => {
      const d = new Date();
      return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
    })();
    const [existing] = await db.select().from(qualificationChartTable)
      .where(eq(qualificationChartTable.callSign, callSign));
    if (existing) {
      await db.update(qualificationChartTable).set({
        rank: newRank, memberName: name,
        lastPromotionDate: today, daysInPresentRank: "0", dutyTimeInRank: "00:00",
        minSeniorityDays: req.minSeniorityDays, minDutyHours: req.minDutyHours,
        loaDaysInRank: 0, // reset LOA counter on rank change
        status: null, updatedAt: new Date(),
      }).where(eq(qualificationChartTable.callSign, callSign));
    } else {
      await createQualChartForMember(callSign, name, newRank, today);
    }
  } catch (err) {
    console.error("[QualChart syncRankChange]", err);
  }
}

// ─── Update accumulated LOA days when member returns from LOA ─────────────────
export async function addLOADaysToQualChart(callSign: string, days: number) {
  try {
    const [row] = await db.select().from(qualificationChartTable)
      .where(eq(qualificationChartTable.callSign, callSign));
    if (row) {
      await db.update(qualificationChartTable)
        .set({ loaDaysInRank: (row.loaDaysInRank ?? 0) + days })
        .where(eq(qualificationChartTable.id, row.id));
    }
  } catch (err) {
    console.error("[QualChart addLOADays]", err);
  }
}

// ─── Delete qual chart entry for a member ────────────────────────────────────
export async function deleteQualChartForMember(callSign: string) {
  try {
    await db.delete(qualificationChartTable)
      .where(eq(qualificationChartTable.callSign, callSign));
  } catch (err) {
    console.error("[QualChart deleteForMember]", err);
  }
}

// ─── GET /qualification-chart ─────────────────────────────────────────────────
router.get("/qualification-chart", async (_req, res) => {
  try {
    const members = await db.select().from(membersTable);
    const memberCallSigns = new Set(members.map(m => m.callSign.trim()));

    const existingRows = await db.select().from(qualificationChartTable);
    const qualByCS = new Map(existingRows.map(r => [r.callSign.trim(), r]));

    // Auto-create rows for members without one
    const toCreate: typeof qualificationChartTable.$inferInsert[] = [];
    for (const m of members) {
      if (!qualByCS.has(m.callSign.trim())) {
        const req = RANK_REQUIREMENTS[m.rank] ?? { minSeniorityDays: "", minDutyHours: "" };
        toCreate.push({
          callSign: m.callSign,
          memberName: m.name,
          rank: m.rank,
          minSeniorityDays: req.minSeniorityDays,
          minDutyHours: req.minDutyHours,
          lastPromotionDate: m.lastPromotionDate ?? null,
          daysInPresentRank: null,
          dutyTimeInRank: null,
          loaDaysInRank: 0,
          status: null, voteByHC: null, notes: null, sortOrder: 999,
        });
      }
    }
    if (toCreate.length > 0) {
      await db.insert(qualificationChartTable).values(toCreate);
      const refreshedRows = await db.select().from(qualificationChartTable);
      qualByCS.clear();
      refreshedRows.forEach(r => qualByCS.set(r.callSign.trim(), r));
    }

    // Remove orphaned rows
    const orphanIds = existingRows
      .filter(r => !memberCallSigns.has(r.callSign.trim()))
      .map(r => r.id);
    if (orphanIds.length > 0) {
      await db.delete(qualificationChartTable).where(
        inArray(qualificationChartTable.id, orphanIds)
      );
    }

    // Fetch all duty logs grouped by member id
    const allLogs = await db.select().from(dutyLogsTable);
    const logsByMid = new Map<number, typeof allLogs>();
    for (const log of allLogs) {
      const arr = logsByMid.get(log.memberId) ?? [];
      arr.push(log);
      logsByMid.set(log.memberId, arr);
    }

    // Build enriched response (one row per real member)
    const result = members.map(member => {
      const row = qualByCS.get(member.callSign.trim())!;
      const isLifetime = ["lifetime"].includes((row.lastPromotionDate ?? "").toLowerCase());

      let computedDaysInRank: number | null = null;
      let computedDutyTime: string | null = null;

      if (!isLifetime) {
        const promotionDate = parseDateFlexible(row.lastPromotionDate ?? member.lastPromotionDate);
        if (promotionDate) {
          computedDaysInRank = Math.max(0, Math.floor((Date.now() - promotionDate.getTime()) / 86400000));
          const pdStr = toYYYYMMDD(promotionDate);
          const logs = (logsByMid.get(member.id) ?? []).filter(l => l.logDate >= pdStr);
          computedDutyTime = formatHHMM(logs.reduce((s,l) => s + l.durationMinutes, 0));
        }
      }

      // Compute LOA days: accumulated + ongoing (if currently on LOA)
      const loaDaysAccum = row.loaDaysInRank ?? 0;
      let computedLOADays = loaDaysAccum;
      let ongoingLOADays = 0;
      if (member.status === "LOA" && member.loaStartDate) {
        const loaStart = new Date(member.loaStartDate);
        if (!isNaN(loaStart.getTime())) {
          ongoingLOADays = Math.max(0, Math.floor((Date.now() - loaStart.getTime()) / 86400000));
          computedLOADays += ongoingLOADays;
        }
      }

      return {
        id: row.id,
        callSign: member.callSign,
        memberName: member.name,
        rank: member.rank,
        status: row.status,
        memberStatus: member.status,
        minSeniorityDays: row.minSeniorityDays ?? (RANK_REQUIREMENTS[member.rank]?.minSeniorityDays ?? null),
        daysInPresentRank: row.daysInPresentRank,
        minDutyHours: row.minDutyHours ?? (RANK_REQUIREMENTS[member.rank]?.minDutyHours ?? null),
        lastPromotionDate: row.lastPromotionDate ?? member.lastPromotionDate ?? null,
        dutyTimeInRank: row.dutyTimeInRank,
        voteByHC: row.voteByHC,
        notes: row.notes,
        sortOrder: row.sortOrder,
        computedDaysInRank,
        computedDutyTime,
        loaDaysInRank: loaDaysAccum,
        computedLOADays,
        isCurrentlyOnLOA: member.status === "LOA",
        ongoingLOADays,
        linkedMemberId: member.id,
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    result.sort((a, b) => {
      const ra = rankSortIdx.get(a.rank) ?? 99;
      const rb = rankSortIdx.get(b.rank) ?? 99;
      if (ra !== rb) return ra - rb;
      return a.callSign.localeCompare(b.callSign);
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch qualification chart" });
  }
});

// ─── PUT /qualification-chart/rank-settings/:rank ────────────────────────────
router.put("/qualification-chart/rank-settings/:rank", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const rank = decodeURIComponent(req.params.rank);
  const { minSeniorityDays, minDutyHours } = req.body as { minSeniorityDays: string; minDutyHours: string };
  try {
    await db.update(qualificationChartTable)
      .set({ minSeniorityDays, minDutyHours, updatedAt: new Date() })
      .where(eq(qualificationChartTable.rank, rank));
    const qcRankBy = (req.headers["x-admin-identity"] as string) || "Unknown";
    await logAction("QUAL_CHART_UPDATED", `Rank: ${rank}`, `Min Seniority: ${minSeniorityDays} · Min Duty: ${minDutyHours}h (all members)`, qcRankBy);
    res.json({ success: true, rank, minSeniorityDays, minDutyHours });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update rank settings" });
  }
});

// ─── PUT /qualification-chart/:id ────────────────────────────────────────────
router.put("/qualification-chart/:id", requireAdminRole(["full", "high-command", "ftb-qc"]), async (req, res) => {
  const id = Number(req.params.id);
  const { callSign, memberName, rank, minSeniorityDays, daysInPresentRank, minDutyHours,
    lastPromotionDate, dutyTimeInRank, status, voteByHC, notes } = req.body;
  try {
    const [existing] = await db.select().from(qualificationChartTable).where(eq(qualificationChartTable.id, id));
    if (!existing) return res.status(404).json({ error: "Row not found" });

    await db.update(qualificationChartTable).set({
      callSign, memberName: memberName || null, rank,
      minSeniorityDays, daysInPresentRank: daysInPresentRank || null,
      minDutyHours, lastPromotionDate: lastPromotionDate || null,
      dutyTimeInRank: dutyTimeInRank || null,
      status: status || null, voteByHC: voteByHC || null,
      notes: notes || null, updatedAt: new Date(),
    }).where(eq(qualificationChartTable.id, id));
    const [updated] = await db.select().from(qualificationChartTable).where(eq(qualificationChartTable.id, id));
    if (!updated) return res.status(404).json({ error: "Row not found" });
    const qcUpdatedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
    await logAction("QUAL_CHART_UPDATED", `${callSign} — ${memberName || ""}`, `Rank: ${rank}`, qcUpdatedBy);
    res.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update row" });
  }
});

// ─── DELETE /qualification-chart/:id ─────────────────────────────────────────
router.delete("/qualification-chart/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [row] = await db.select().from(qualificationChartTable)
      .where(eq(qualificationChartTable.id, id));
    if (row) {
      const qcDeletedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
      await logAction("QUAL_CHART_DELETED", `${row.callSign} — ${row.memberName || ""}`, `Rank: ${row.rank}`, qcDeletedBy);
    }
    await db.delete(qualificationChartTable).where(eq(qualificationChartTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete row" });
  }
});

export default router;
