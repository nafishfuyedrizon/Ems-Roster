import { Router } from "express";
import { resolveAdminRole } from "../lib/admin-auth";

const router = Router();

const OWNER_DISCORD_ID = "1286283853186596904";

router.get("/validate-access", async (req, res) => {
  const identity = (req.headers["x-admin-identity"] as string) || "";
  const discordId = (req.headers["x-discord-id"] as string) || "";

  // Master password users always valid
  if (identity === "Master Key") {
    return res.json({ valid: true });
  }

  // Owner Discord ID always valid
  if (discordId === OWNER_DISCORD_ID) {
    return res.json({ valid: true });
  }

  if (!identity) {
    return res.json({ valid: false });
  }

  try {
    const role = await resolveAdminRole(req);
    return res.json({ valid: !!role, role });
  } catch (err) {
    console.error("[VALIDATE-ACCESS] Error:", err);
    return res.json({ valid: false });
  }
});

export default router;
