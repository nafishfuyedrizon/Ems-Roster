import { Router } from "express";
import { db } from "@workspace/db";
import { shiftConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logAction } from "../lib/panel-logger";
import { requireAdminRole } from "../lib/admin-auth";

const router = Router();

const DEFAULTS = [
  { shiftName: "Evening",  startHour: 20, endHour: 22 },
  { shiftName: "Night",    startHour: 22, endHour: 24 },
  { shiftName: "Midnight", startHour: 0,  endHour: 2  },
];

async function ensureDefaults() {
  for (const def of DEFAULTS) {
    const existing = await db
      .select()
      .from(shiftConfigTable)
      .where(eq(shiftConfigTable.shiftName, def.shiftName));
    if (existing.length === 0) {
      await db.insert(shiftConfigTable).values(def);
    }
  }
}

router.get("/shift-config", async (_req, res) => {
  try {
    await ensureDefaults();
    const rows = await db.select().from(shiftConfigTable);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shift config" });
  }
});

router.put("/shift-config/:shiftName", requireAdminRole(["full", "high-command"]), async (req, res) => {
  const { shiftName } = req.params;
  const { startHour, endHour, displayName } = req.body;

  if (
    typeof startHour !== "number" || typeof endHour !== "number" ||
    startHour < 0 || startHour > 23 || endHour < 0 || endHour > 24
  ) {
    return res.status(400).json({ error: "Invalid hour values (0–23 for start, 0–24 for end)" });
  }

  if (!["Evening", "Night", "Midnight"].includes(shiftName)) {
    return res.status(400).json({ error: "Invalid shift name" });
  }

  const updatePayload: Record<string, any> = { startHour, endHour, updatedAt: new Date() };
  if (typeof displayName === "string" && displayName.trim().length > 0) {
    updatePayload.displayName = displayName.trim();
  }

  try {
    await db
      .update(shiftConfigTable)
      .set(updatePayload)
      .where(eq(shiftConfigTable.shiftName, shiftName));

    const adminName = (req as any).session?.adminIdentity ?? "Admin";
    const label = updatePayload.displayName ?? shiftName;
    await logAction(adminName, "UPDATE", "ShiftConfig", `${label}: ${startHour}:00–${endHour}:00`);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update shift config" });
  }
});

export default router;
