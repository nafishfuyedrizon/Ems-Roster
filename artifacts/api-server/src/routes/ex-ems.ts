import { Router } from "express";
import { db, exEmsTable, membersTable, qualificationChartTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logAction } from "../lib/panel-logger";
import { requireAdminRole } from "../lib/admin-auth";

const router = Router();

// GET /ex-ems
router.get("/ex-ems", async (_req, res) => {
  const rows = await db.select().from(exEmsTable).orderBy(exEmsTable.createdAt);
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// POST /ex-ems  (manual create)
router.post("/ex-ems", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const performedBy: string = req.headers["x-admin-identity"] as string ?? "Unknown";
  const { callSign, name, rank, discordId, discordUsername, licenseId, exitStatus, proof, exitDate,
    isFighter, isRru, isTvu, isMedevacAdvanced, isMedevacTrainee, notes, addedBy } = req.body;

  if (!callSign || !name || !rank) {
    return res.status(400).json({ error: "callSign, name, rank required" });
  }

  const [inserted] = await db.insert(exEmsTable).values({
    callSign, name, rank,
    discordId: discordId || null,
    discordUsername: discordUsername || null,
    licenseId: licenseId || null,
    exitStatus: exitStatus || "RESIGNED",
    proof: proof || null,
    exitDate: exitDate || null,
    isFighter: !!isFighter,
    isRru: !!isRru,
    isTvu: !!isTvu,
    isMedevacAdvanced: !!isMedevacAdvanced,
    isMedevacTrainee: !!isMedevacTrainee,
    notes: notes || null,
    addedBy: addedBy || performedBy || null,
  }).$returningId();
  const [row] = await db.select().from(exEmsTable).where(eq(exEmsTable.id, inserted.id));
  if (!row) return res.status(500).json({ error: "Ex EMS record was created but could not be reloaded" });

  await logAction("EX_EMS_ADDED", name, `Added as Ex EMS [${exitStatus}]`, performedBy);
  res.json(row);
});

// POST /ex-ems/convert/:memberId  (convert active EMS → Ex EMS)
router.post("/ex-ems/convert/:memberId", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const performedBy: string = req.headers["x-admin-identity"] as string ?? "Unknown";
  const memberId = parseInt(req.params["memberId"]);
  const { exitStatus, proof, exitDate } = req.body;

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member) return res.status(404).json({ error: "Member not found" });

  // Auto-detect all FTB qualifications from member's existing data
  const isFighter      = member.highCamNoted === "✔ High-Command";
  const isMedevacAdvanced = member.medTrex === "Advance" || member.ftoMember === "FTP Supervisor";
  const isMedevacTrainee  = member.medTrex === "Trainee"  || member.ftoMember === "FTP Trainer";
  const isTvu          = member.ftoMember === "FTP Advanced";
  const isRru          = member.ftoMember === "FTP Recruit";

  // Insert into ex_ems
  const [inserted] = await db.insert(exEmsTable).values({
    callSign: member.callSign,
    name: member.name,
    rank: member.rank,
    discordId: member.discordId || null,
    discordUsername: member.discordUsername || null,
    licenseId: member.licenseKey || null,
    exitStatus: exitStatus || "RESIGNED",
    proof: proof || "Removed",
    exitDate: exitDate || null,
    isFighter,
    isRru,
    isTvu,
    isMedevacAdvanced,
    isMedevacTrainee,
    notes: member.notes || null,
    addedBy: performedBy || null,
  }).$returningId();
  const [exRow] = await db.select().from(exEmsTable).where(eq(exEmsTable.id, inserted.id));
  if (!exRow) return res.status(500).json({ error: "Ex EMS record was created but could not be reloaded" });

  // Remove from qualification chart
  await db.delete(qualificationChartTable).where(eq(qualificationChartTable.callSign, member.callSign));

  // Remove from members
  await db.delete(membersTable).where(eq(membersTable.id, memberId));

  await logAction("EMS_CONVERTED_TO_EX", member.name, `${member.rank} → Ex EMS [${exitStatus}]`, performedBy);
  res.json(exRow);
});

// PUT /ex-ems/:id
router.put("/ex-ems/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const performedBy: string = req.headers["x-admin-identity"] as string ?? "Unknown";
  const id = parseInt(req.params["id"]);
  const { callSign, name, rank, discordId, discordUsername, licenseId, exitStatus, proof, exitDate,
    isFighter, isRru, isTvu, isMedevacAdvanced, isMedevacTrainee, notes, addedBy } = req.body;

  const [existing] = await db.select().from(exEmsTable).where(eq(exEmsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  await db.update(exEmsTable).set({
    callSign, name, rank,
    discordId: discordId || null,
    discordUsername: discordUsername || null,
    licenseId: licenseId || null,
    exitStatus: exitStatus || "RESIGNED",
    proof: proof || null,
    exitDate: exitDate || null,
    isFighter: !!isFighter,
    isRru: !!isRru,
    isTvu: !!isTvu,
    isMedevacAdvanced: !!isMedevacAdvanced,
    isMedevacTrainee: !!isMedevacTrainee,
    notes: notes || null,
    addedBy: addedBy || null,
  }).where(eq(exEmsTable.id, id));

  const [row] = await db.select().from(exEmsTable).where(eq(exEmsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  await logAction("EX_EMS_UPDATED", name, `Updated Ex EMS record`, performedBy);
  res.json(row);
});

// DELETE /ex-ems/:id
  router.delete("/ex-ems/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const performedBy: string = req.headers["x-admin-identity"] as string ?? "Unknown";
  const id = parseInt(req.params["id"]);
  const [row] = await db.select().from(exEmsTable).where(eq(exEmsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  await db.delete(exEmsTable).where(eq(exEmsTable.id, id));
  await logAction("EX_EMS_DELETED", row.name, `Deleted Ex EMS record`, performedBy);
  res.json({ success: true });
});

export default router;
