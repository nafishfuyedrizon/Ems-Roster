import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, doctorAccountsTable, membersTable } from "@workspace/db";
import { clearDoctorSession, requireDoctorAuth, verifyPassword, writeDoctorSession } from "../lib/doctor-auth";

const router = Router();

router.post("/doctor-auth/login", async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const [doctor] = await db
    .select({
      doctorAccountId: doctorAccountsTable.id,
      memberId: membersTable.id,
      username: doctorAccountsTable.username,
      passwordHash: doctorAccountsTable.passwordHash,
      isActive: doctorAccountsTable.isActive,
      callSign: membersTable.callSign,
      rank: membersTable.rank,
      name: membersTable.name,
    })
    .from(doctorAccountsTable)
    .innerJoin(membersTable, eq(doctorAccountsTable.memberId, membersTable.id))
    .where(eq(doctorAccountsTable.username, username))
    .limit(1);

  if (!doctor || !doctor.isActive) {
    return res.status(401).json({ error: "Invalid doctor credentials." });
  }

  const valid = await verifyPassword(password, doctor.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid doctor credentials." });
  }

  await db.update(doctorAccountsTable).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(doctorAccountsTable.id, doctor.doctorAccountId));

  writeDoctorSession(req, res, {
    doctorAccountId: doctor.doctorAccountId,
    memberId: doctor.memberId,
    username: doctor.username,
    callSign: doctor.callSign,
    rank: doctor.rank,
    name: doctor.name,
  });

  return res.json({
    success: true,
    doctor: {
      id: doctor.doctorAccountId,
      memberId: doctor.memberId,
      username: doctor.username,
      callSign: doctor.callSign,
      rank: doctor.rank,
      name: doctor.name,
    },
  });
});

router.post("/doctor-auth/logout", (req, res) => {
  clearDoctorSession(req, res);
  return res.status(204).send();
});

router.get("/doctor-auth/session", requireDoctorAuth, async (req, res) => {
  return res.json({
    doctor: (req as any).doctorSession,
  });
});

export default router;
