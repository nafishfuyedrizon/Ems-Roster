import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, panelLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/panel-logs", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await db
      .select()
      .from(panelLogsTable)
      .orderBy(desc(panelLogsTable.createdAt))
      .limit(limit);

    res.json(logs.map(l => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error("[API] /panel-logs error:", err);
    res.status(500).json({ error: "Failed to fetch panel logs" });
  }
});

export default router;
