import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, doctorAccountsTable, membersTable } from "@workspace/db";
import { requireAdminRole } from "../lib/admin-auth";
import { hashPassword } from "../lib/doctor-auth";

const router = Router();

function isDuplicateEntryError(error: unknown) {
  const candidate = error as {
    code?: string;
    errno?: number;
    message?: string;
    cause?: { code?: string; errno?: number; message?: string };
  } | null;

  const values = [
    candidate?.code,
    String(candidate?.errno ?? ""),
    candidate?.message,
    candidate?.cause?.code,
    String(candidate?.cause?.errno ?? ""),
    candidate?.cause?.message,
  ]
    .filter(Boolean)
    .join(" ");

  return /ER_DUP_ENTRY|1062|Duplicate entry/i.test(values);
}

router.get("/doctor-accounts", requireAdminRole(["full", "high-command"]), async (_req, res) => {
  const rows = await db
    .select({
      id: doctorAccountsTable.id,
      memberId: doctorAccountsTable.memberId,
      username: doctorAccountsTable.username,
      isActive: doctorAccountsTable.isActive,
      createdBy: doctorAccountsTable.createdBy,
      lastLoginAt: doctorAccountsTable.lastLoginAt,
      createdAt: doctorAccountsTable.createdAt,
      updatedAt: doctorAccountsTable.updatedAt,
      callSign: membersTable.callSign,
      rank: membersTable.rank,
      name: membersTable.name,
    })
    .from(doctorAccountsTable)
    .innerJoin(membersTable, eq(doctorAccountsTable.memberId, membersTable.id));

  return res.json(rows.map((row) => ({
    ...row,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })));
});

router.post("/doctor-accounts", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const memberId = Number(req.body?.memberId);
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!memberId || !username || !password) {
    return res.status(400).json({ error: "memberId, username, and password are required." });
  }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId)).limit(1);
  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  const passwordHash = await hashPassword(password);
  const createdBy = (req.headers["x-admin-identity"] as string) || "Unknown";

  try {
    const [inserted] = await db.insert(doctorAccountsTable).values({
      memberId,
      username,
      passwordHash,
      createdBy,
    }).$returningId();

    return res.status(201).json({ id: inserted.id, memberId, username, createdPassword: password });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      const [existingByMember] = await db
        .select({ id: doctorAccountsTable.id })
        .from(doctorAccountsTable)
        .where(eq(doctorAccountsTable.memberId, memberId))
        .limit(1);

      if (existingByMember) {
        return res.status(409).json({ error: "This member already has a doctor account." });
      }

      const [existingByUsername] = await db
        .select({ id: doctorAccountsTable.id })
        .from(doctorAccountsTable)
        .where(eq(doctorAccountsTable.username, username))
        .limit(1);

      if (existingByUsername) {
        return res.status(409).json({ error: "This username is already in use." });
      }

      return res.status(409).json({ error: "A doctor account with this information already exists." });
    }

    console.error("[DOCTOR-ACCOUNTS] Failed to create account:", error);
    return res.status(500).json({ error: "Failed to create doctor account." });
  }
});

router.patch("/doctor-accounts/:id", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid account id." });

  const updateData: Partial<typeof doctorAccountsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof req.body?.username === "string" && req.body.username.trim()) {
    updateData.username = req.body.username.trim();
  }
  if (typeof req.body?.isActive === "boolean") {
    updateData.isActive = req.body.isActive;
  }

  await db.update(doctorAccountsTable).set(updateData).where(eq(doctorAccountsTable.id, id));
  return res.status(204).send();
});

router.post("/doctor-accounts/:id/reset-password", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const id = Number(req.params.id);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!id || !password) {
    return res.status(400).json({ error: "A new password is required." });
  }

  const passwordHash = await hashPassword(password);
  await db.update(doctorAccountsTable).set({
    passwordHash,
    updatedAt: new Date(),
  }).where(eq(doctorAccountsTable.id, id));

  return res.json({ success: true, password });
});

export default router;
