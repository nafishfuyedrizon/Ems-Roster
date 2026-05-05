import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, dutyLogsTable, membersTable } from "@workspace/db";
import {
  ListDutyLogsQueryParams,
  CreateDutyLogBody,
  UpdateDutyLogParams,
  UpdateDutyLogBody,
  DeleteDutyLogParams,
} from "@workspace/api-zod";
import { logAction } from "../lib/panel-logger";
import { formatDuration } from "../lib/format-duration";
import { requireAdminRole } from "../lib/admin-auth";

const router: IRouter = Router();

router.get("/duty-logs", async (req, res) => {
  const query = ListDutyLogsQueryParams.parse(req.query);
  const fromDate = req.query.fromDate as string | undefined;
  const toDate   = req.query.toDate   as string | undefined;

  const conditions = [];
  if (query.memberId !== undefined) conditions.push(eq(dutyLogsTable.memberId, Number(query.memberId)));
  if (query.weekStart) conditions.push(eq(dutyLogsTable.weekStart, query.weekStart));
  if (query.shiftType) conditions.push(eq(dutyLogsTable.shiftType, query.shiftType as "Evening" | "Night" | "Midnight" | "Full"));
  if (fromDate) conditions.push(gte(dutyLogsTable.logDate, fromDate));
  if (toDate)   conditions.push(lte(dutyLogsTable.logDate, toDate));

  const logs = conditions.length > 0
    ? await db.select().from(dutyLogsTable).where(and(...conditions))
    : await db.select().from(dutyLogsTable);

  res.json(logs.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  })));
});

router.post("/duty-logs", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const body = CreateDutyLogBody.parse(req.body);
  const [inserted] = await db.insert(dutyLogsTable).values({
    memberId: body.memberId,
    weekStart: body.weekStart,
    shiftType: body.shiftType as "Evening" | "Night" | "Midnight" | "Full",
    durationMinutes: body.durationMinutes,
    logDate: body.logDate,
    notes: body.notes ?? null,
  }).$returningId();
  const [log] = await db.select().from(dutyLogsTable).where(eq(dutyLogsTable.id, inserted.id));
  if (!log) return res.status(500).json({ error: "Duty log was created but could not be reloaded" });
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, log.memberId));
  const memberLabel = member ? `[${member.callSign}] ${member.name}` : `Member #${log.memberId}`;
  const dutyCreatedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
  await logAction("DUTY_LOG_CREATED", memberLabel, `${log.shiftType} shift · ${log.logDate} · ${formatDuration(log.durationMinutes)}`, dutyCreatedBy);
  res.status(201).json({
    ...log,
    createdAt: log.createdAt.toISOString(),
  });
});

router.put("/duty-logs/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const { id } = UpdateDutyLogParams.parse({ id: Number(req.params.id) });
  const body = UpdateDutyLogBody.parse(req.body);
  const updateData: Partial<typeof dutyLogsTable.$inferInsert> = {};
  if (body.shiftType !== undefined) updateData.shiftType = body.shiftType as "Evening" | "Night" | "Midnight" | "Full";
  if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes;
  if (body.logDate !== undefined) updateData.logDate = body.logDate;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const [existing] = await db.select().from(dutyLogsTable).where(eq(dutyLogsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Duty log not found" });
  await db.update(dutyLogsTable).set(updateData).where(eq(dutyLogsTable.id, id));
  const [log] = await db.select().from(dutyLogsTable).where(eq(dutyLogsTable.id, id));
  if (!log) return res.status(404).json({ error: "Duty log not found" });
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, log.memberId));
  const memberLabel = member ? `[${member.callSign}] ${member.name}` : `Member #${log.memberId}`;
  const dutyUpdatedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
  await logAction("DUTY_LOG_UPDATED", memberLabel, `${log.shiftType} shift · ${log.logDate} · ${formatDuration(log.durationMinutes)}`, dutyUpdatedBy);
  res.json({
    ...log,
    createdAt: log.createdAt.toISOString(),
  });
});

router.delete("/duty-logs/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const { id } = DeleteDutyLogParams.parse({ id: Number(req.params.id) });
  const [log] = await db.select().from(dutyLogsTable).where(eq(dutyLogsTable.id, id));
  if (log) {
    const [member] = await db.select().from(membersTable).where(eq(membersTable.id, log.memberId));
    const memberLabel = member ? `[${member.callSign}] ${member.name}` : `Member #${log.memberId}`;
    const dutyDeletedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
    await logAction("DUTY_LOG_DELETED", memberLabel, `${log.shiftType} shift · ${log.logDate} · ${formatDuration(log.durationMinutes)}`, dutyDeletedBy);
  }
  await db.delete(dutyLogsTable).where(eq(dutyLogsTable.id, id));
  res.status(204).send();
});

export default router;
