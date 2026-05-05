import { Router } from "express";
import { db } from "@workspace/db";
import { membersTable, staffRolesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";
const MASTER_KEYS = (process.env.ADMIN_MASTER_KEYS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function getRedirectUri(req: import("express").Request): string {
  if (process.env.DISCORD_REDIRECT_URI) return process.env.DISCORD_REDIRECT_URI;
  const host = process.env.REPLIT_DEV_DOMAIN || req.get("host") || "localhost";
  return `https://${host}/api/auth/discord/callback`;
}

function postMessageHTML(data: object): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Authenticating...</title>
  <style>
    body { background: #0a0f1a; color: #00e5cc; font-family: monospace; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
    p { font-size:14px; letter-spacing:2px; text-transform:uppercase; }
  </style>
</head>
<body>
<p>Authenticating... window will close.</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify({ type: "DISCORD_AUTH_RESULT", ...data })}, '*');
      window.close();
    } else {
      window.location.href = '/ems-panel/admin';
    }
  } catch(e) {
    window.location.href = '/ems-panel/admin';
  }
</script>
</body>
</html>`;
}

router.post("/auth/master-key", (req, res) => {
  if (MASTER_KEYS.length === 0) {
    return res.status(500).json({ success: false, error: "Master key login is not configured." });
  }

  const input = typeof req.body?.key === "string" ? req.body.key : "";
  if (!input) {
    return res.status(400).json({ success: false, error: "Master key is required." });
  }

  if (!MASTER_KEYS.includes(input)) {
    return res.status(401).json({ success: false, error: "Invalid master key." });
  }

  return res.json({ success: true, role: "full", identity: "Master Key" });
});

router.get("/auth/discord", (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).send(postMessageHTML({ success: false, error: "Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET." }));
  }

  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const redirectUri = getRedirectUri(req);

  res.cookie("discord_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
    path: "/",
  });

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

router.get("/auth/discord/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const storedState = (req as any).cookies?.discord_oauth_state;

  res.clearCookie("discord_oauth_state", { path: "/" });

  if (error || !code) {
    return res.send(postMessageHTML({ success: false, error: "Discord authorization was cancelled." }));
  }

  if (!state || !storedState || state !== storedState) {
    return res.send(postMessageHTML({ success: false, error: "Invalid state parameter. Please try again." }));
  }

  try {
    const redirectUri = getRedirectUri(req);

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return res.send(postMessageHTML({ success: false, error: "Failed to exchange Discord code. Please try again." }));
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.send(postMessageHTML({ success: false, error: "Failed to fetch Discord user info." }));
    }

    const discordUser = await userRes.json() as { id: string; username: string; global_name?: string };
    const discordId = discordUser.id;
    const discordName = discordUser.global_name ?? discordUser.username;

    // ─── Owner bypass — always full access ───────────────────────────────────
    const OWNER_DISCORD_ID = "1286283853186596904";
    if (discordId === OWNER_DISCORD_ID) {
      const ownerMember = await db
        .select({ callSign: membersTable.callSign })
        .from(membersTable)
        .where(eq(membersTable.discordId, discordId))
        .limit(1);
      return res.send(postMessageHTML({
        success: true,
        role: "full",
        identity: ownerMember[0]?.callSign ?? discordName,
      }));
    }

    const member = await db
      .select({ id: membersTable.id, callSign: membersTable.callSign, name: membersTable.name })
      .from(membersTable)
      .where(eq(membersTable.discordId, discordId))
      .limit(1);

    if (!member.length) {
      return res.send(postMessageHTML({
        success: false,
        error: `Discord account "${discordName}" is not linked to any EMS member.`,
      }));
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

    if (!roleRow.length) {
      return res.send(postMessageHTML({
        success: false,
        error: `No admin permissions assigned to ${member[0].callSign}.`,
      }));
    }

    const r = roleRow[0];
    let role: string | null = null;
    if (r.isSuperAdmin) role = "full";
    else if (r.isSeniorStaff) role = "high-command";
    else if (r.isStaff) role = "ftp-ems";
    else if (r.isFTB && r.hasQCAccess) role = "ftb-qc";

    if (!role) {
      return res.send(postMessageHTML({
        success: false,
        error: `No admin permissions assigned to ${member[0].callSign}.`,
      }));
    }

    return res.send(postMessageHTML({
      success: true,
      role,
      identity: member[0].callSign,
    }));
  } catch (err) {
    console.error("Discord OAuth callback error:", err);
    return res.send(postMessageHTML({ success: false, error: "An unexpected error occurred. Please try again." }));
  }
});

export default router;
