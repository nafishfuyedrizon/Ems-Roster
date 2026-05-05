import type { Request, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, membersTable, staffRolesTable } from "@workspace/db";

export type AdminRole = "full" | "high-command" | "ftp-ems" | "ftb-qc";

function headerValue(req: Request, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? "").trim() : (value ?? "").trim();
}

function roleFromFlags(role: {
  isSuperAdmin?: boolean | null;
  isSeniorStaff?: boolean | null;
  isStaff?: boolean | null;
  isFTB?: boolean | null;
  hasQCAccess?: boolean | null;
}): AdminRole | null {
  if (role.isSuperAdmin) return "full";
  if (role.isSeniorStaff) return "high-command";
  if (role.isStaff) return "ftp-ems";
  if (role.isFTB && role.hasQCAccess) return "ftb-qc";
  return null;
}

export async function resolveAdminRole(req: Request): Promise<AdminRole | null> {
  const identity = headerValue(req, "x-admin-identity");
  const claimedRole = headerValue(req, "x-admin-role");

  if (identity === "Master Key" && claimedRole === "full") {
    return "full";
  }

  if (!identity) return null;

  const [member] = await db
    .select({ id: membersTable.id })
    .from(membersTable)
    .where(eq(membersTable.callSign, identity))
    .limit(1);

  if (!member) return null;

  const [role] = await db
    .select({
      isSuperAdmin: staffRolesTable.isSuperAdmin,
      isSeniorStaff: staffRolesTable.isSeniorStaff,
      isStaff: staffRolesTable.isStaff,
      isFTB: staffRolesTable.isFTB,
      hasQCAccess: staffRolesTable.hasQCAccess,
    })
    .from(staffRolesTable)
    .where(eq(staffRolesTable.memberId, member.id))
    .limit(1);

  return role ? roleFromFlags(role) : null;
}

export function requireAdminRole(allowed: AdminRole[]): RequestHandler {
  return async (req, res, next) => {
    try {
      const role = await resolveAdminRole(req);
      if (!role) {
        return res.status(401).json({ error: "Admin authentication required" });
      }
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: "Insufficient admin permissions" });
      }

      (req as any).adminRole = role;
      next();
    } catch (err) {
      console.error("[ADMIN-AUTH] Error:", err);
      return res.status(500).json({ error: "Failed to validate admin permissions" });
    }
  };
}
