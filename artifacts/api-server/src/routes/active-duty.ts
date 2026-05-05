import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, activeDutySessionsTable, membersTable } from "@workspace/db";
import { ACTIVE_DUTY_MAX_HOURS, splitActiveDutySessionsByFreshness } from "../lib/active-duty";

const router: IRouter = Router();

router.get("/active-duty", async (_req, res) => {
  try {
    const sessions = await db
      .select({
        id: activeDutySessionsTable.id,
        memberId: activeDutySessionsTable.memberId,
        licenseKey: activeDutySessionsTable.licenseKey,
        playerName: activeDutySessionsTable.playerName,
        startTime: activeDutySessionsTable.startTime,
        callSign: membersTable.callSign,
        rank: membersTable.rank,
        name: membersTable.name,
      })
      .from(activeDutySessionsTable)
      .leftJoin(membersTable, eq(activeDutySessionsTable.memberId, membersTable.id))
      .orderBy(activeDutySessionsTable.startTime);

    const { fresh, stale } = splitActiveDutySessionsByFreshness(sessions);

    res.json({
      count: fresh.length,
      sessions: fresh,
      updatedAt: new Date().toISOString(),
      source: "timestamp-license-sessions",
      staleSessionsFiltered: stale.length,
      activeDutyMaxHours: ACTIVE_DUTY_MAX_HOURS,
    });
  } catch (err) {
    console.error("[API] /active-duty error:", err);
    res.status(500).json({ error: "Failed to fetch active duty sessions" });
  }
});

export default router;
