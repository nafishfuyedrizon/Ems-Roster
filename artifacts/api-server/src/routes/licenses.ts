import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, licensesTable } from "@workspace/db";
import {
  CreateLicenseBody,
  DeleteLicenseParams,
} from "@workspace/api-zod";
import { requireAdminRole } from "../lib/admin-auth";

const router: IRouter = Router();

router.get("/licenses", async (_req, res) => {
  const licenses = await db.select().from(licensesTable);
  res.json(licenses.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  })));
});

router.post("/licenses", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const body = CreateLicenseBody.parse(req.body);
  const [inserted] = await db.insert(licensesTable).values({
    licenseKey: body.licenseKey,
    memberId: body.memberId ?? null,
    memberName: null,
    onDutyCount: body.onDutyCount,
    offDutyCount: body.offDutyCount,
    lastSeen: body.lastSeen ?? null,
  }).$returningId();
  const [license] = await db.select().from(licensesTable).where(eq(licensesTable.id, inserted.id));
  if (!license) return res.status(500).json({ error: "License was created but could not be reloaded" });
  res.status(201).json({
    ...license,
    createdAt: license.createdAt.toISOString(),
  });
});

router.delete("/licenses/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const { id } = DeleteLicenseParams.parse({ id: Number(req.params.id) });
  await db.delete(licensesTable).where(eq(licensesTable.id, id));
  res.status(204).send();
});

export default router;
