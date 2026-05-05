import { db, panelLogsTable } from "@workspace/db";

type Action =
  | "MEMBER_CREATED" | "MEMBER_UPDATED" | "MEMBER_DELETED"
  | "DUTY_LOG_CREATED" | "DUTY_LOG_UPDATED" | "DUTY_LOG_DELETED"
  | "STAFF_ROLES_UPDATED"
  | "QUAL_CHART_CREATED" | "QUAL_CHART_UPDATED" | "QUAL_CHART_DELETED";

export async function logAction(
  action: Action,
  targetName: string,
  details: string,
  performedBy = "Unknown",
): Promise<void> {
  try {
    await db.insert(panelLogsTable).values({ action, targetName, details, performedBy });
  } catch (err) {
    console.error("[PANEL-LOG] Failed to write log:", err);
  }
}
