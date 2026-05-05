import { Router } from "express";
import { db } from "@workspace/db";
import { staffRolesTable, membersTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { logAction } from "../lib/panel-logger";
import { requireAdminRole } from "../lib/admin-auth";

const router = Router();

router.get("/staff-roles", async (_req, res) => {
  try {
    const members = await db
      .select({
        id: membersTable.id,
        callSign: membersTable.callSign,
        name: membersTable.name,
        rank: membersTable.rank,
        status: membersTable.status,
      })
      .from(membersTable)
      .orderBy(asc(membersTable.callSign));

    const roles = await db.select().from(staffRolesTable);
    const roleMap = new Map(roles.map((r) => [r.memberId, r]));

    const result = members.map((m) => {
      const role = roleMap.get(m.id);
      return {
        memberId: m.id,
        callSign: m.callSign,
        name: m.name,
        rank: m.rank,
        status: m.status,
        isSuperAdmin: role?.isSuperAdmin ?? false,
        isSeniorStaff: role?.isSeniorStaff ?? false,
        isStaff: role?.isStaff ?? false,
        isFTB: role?.isFTB ?? false,
        hasQCAccess: role?.hasQCAccess ?? false,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff roles" });
  }
});

router.put("/staff-roles/:memberId", requireAdminRole(["full", "high-command"]), async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const { isSuperAdmin, isSeniorStaff, isStaff, isFTB, hasQCAccess } = req.body;
    const currentAdminRole = (req as any).adminRole;

    if (currentAdminRole === "high-command" && (isSuperAdmin || isSeniorStaff)) {
      return res.status(403).json({ error: "High Command cannot grant Full Power or High Command roles" });
    }

    const existing = await db
      .select()
      .from(staffRolesTable)
      .where(eq(staffRolesTable.memberId, memberId))
      .limit(1);

    const payload = {
      isSuperAdmin: !!isSuperAdmin,
      isSeniorStaff: !!isSeniorStaff,
      isStaff: !!isStaff,
      isFTB: !!isFTB,
      hasQCAccess: !!hasQCAccess,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(staffRolesTable)
        .set(payload)
        .where(eq(staffRolesTable.memberId, memberId));
    } else {
      await db.insert(staffRolesTable).values({ memberId, ...payload });
    }

    const member = await db
      .select({ callSign: membersTable.callSign })
      .from(membersTable)
      .where(eq(membersTable.id, memberId))
      .limit(1);

    const callSign = member[0]?.callSign ?? `Member #${memberId}`;
    const roleLabels: Record<string, string> = {
      isSuperAdmin: "Full Power",
      isSeniorStaff: "High Command",
      isStaff: "FTP EMS",
      isFTB: "FTB",
      hasQCAccess: "QC Access",
    };
    const activeRoles = Object.entries({ isSuperAdmin, isSeniorStaff, isStaff, isFTB, hasQCAccess })
      .filter(([, v]) => v)
      .map(([k]) => roleLabels[k] ?? k)
      .join(", ") || "None";

    const roleUpdatedBy = (req.headers["x-admin-identity"] as string) || "Unknown";
    await logAction("STAFF_ROLES_UPDATED", callSign, `Roles set: ${activeRoles}`, roleUpdatedBy);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update staff roles" });
  }
});

router.get("/staff-roles/check-admin/:callSign", async (req, res) => {
  try {
    const callSign = req.params.callSign.trim();
    const member = await db
      .select({ id: membersTable.id, callSign: membersTable.callSign })
      .from(membersTable)
      .where(eq(membersTable.callSign, callSign))
      .limit(1);

    if (!member.length) {
      return res.json({ hasAccess: false });
    }

    const roleRow = await db
      .select({
        isSuperAdmin: staffRolesTable.isSuperAdmin,
        isSeniorStaff: staffRolesTable.isSeniorStaff,
        isStaff: staffRolesTable.isStaff,
        isFTB: staffRolesTable.isFTB,
        hasQCAccess: staffRolesTable.hasQCAccess,
      })
      .from(staffRolesTable)
      .where(eq(staffRolesTable.memberId, member[0].id))
      .limit(1);

    if (!roleRow.length) return res.json({ hasAccess: false });

    const r = roleRow[0];
    if (r.isSuperAdmin) {
      return res.json({ hasAccess: true, role: "full", callSign: member[0].callSign });
    }
    if (r.isSeniorStaff) {
      return res.json({ hasAccess: true, role: "high-command", callSign: member[0].callSign });
    }
    if (r.isStaff) {
      return res.json({ hasAccess: true, role: "ftp-ems", callSign: member[0].callSign });
    }
    // FTB + QC Access → can access Qual Chart tab
    if (r.isFTB && r.hasQCAccess) {
      return res.json({ hasAccess: true, role: "ftb-qc", callSign: member[0].callSign });
    }
    return res.json({ hasAccess: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check admin access" });
  }
});

export default router;
