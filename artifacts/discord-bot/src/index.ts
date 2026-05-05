import "@workspace/db/load-env";
import { Client, GatewayIntentBits, Message, TextChannel, Events } from "discord.js";
import { db, membersTable, dutyLogsTable, activeDutySessionsTable, shiftConfigTable } from "@workspace/db";
import { eq, and, gte, inArray } from "drizzle-orm";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_TIMESTAMP_CHANNEL_ID;
const CURRENT_SCAN_LIMIT = 1000;
const BACKFILL_MONTHS = Number(process.env.BACKFILL_MONTHS ?? 3);
const REBUILD_BACKFILL = process.env.REBUILD_BACKFILL === "1";
const BACKFILL_PAGE_DELAY_MS = Number(process.env.BACKFILL_PAGE_DELAY_MS ?? 25);
const BACKFILL_OVERLAP_DAYS = Number(process.env.BACKFILL_OVERLAP_DAYS ?? 3);

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error("[BOT] Missing DISCORD_BOT_TOKEN or DISCORD_TIMESTAMP_CHANNEL_ID");
  process.exit(1);
}

interface ActiveSession {
  startTime: Date;
  memberId: number;
  playerName: string;
}

const activeSessions = new Map<string, ActiveSession>();
let startupSyncComplete = false;
const pendingLiveMessages: Message[] = [];
const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;
type ShiftType = "Evening" | "Night" | "Midnight" | "Full";
type ShiftConfigRow = { shiftName: string; startHour: number; endHour: number };
type DutySegment = {
  shiftType: ShiftType;
  weekStart: string;
  logDate: string;
  durationSeconds: number;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toBdtDate(date: Date): Date {
  return new Date(date.getTime() + BDT_OFFSET_MS);
}

function getBdtWeekStart(date: Date): string {
  const d = toBdtDate(date);
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat in BDT
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getBdtLogDate(date: Date): string {
  const d = toBdtDate(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeEndHour(startHour: number, endHour: number): number {
  return endHour === 0 && startHour > 0 ? 24 : endHour;
}

async function loadShiftConfigs(): Promise<ShiftConfigRow[]> {
  try {
    return await db.select({
      shiftName: shiftConfigTable.shiftName,
      startHour: shiftConfigTable.startHour,
      endHour: shiftConfigTable.endHour,
    }).from(shiftConfigTable);
  } catch (err) {
    console.warn("[BOT] Could not load shift config from DB, using defaults:", err);
    return [
      { shiftName: "Evening", startHour: 20, endHour: 22 },
      { shiftName: "Night", startHour: 22, endHour: 24 },
      { shiftName: "Midnight", startHour: 0, endHour: 2 },
    ];
  }
}

function getBdtShiftType(date: Date, configs: ShiftConfigRow[]): ShiftType {
  const hour = toBdtDate(date).getUTCHours();
  for (const row of configs) {
    if (!["Evening", "Night", "Midnight"].includes(row.shiftName)) continue;
    const startHour = row.startHour;
    const endHour = normalizeEndHour(startHour, row.endHour);
    if (startHour < endHour) {
      if (hour >= startHour && hour < endHour) return row.shiftName as ShiftType;
    } else if (hour >= startHour || hour < endHour) {
      return row.shiftName as ShiftType;
    }
  }
  return "Full";
}

function bdtBoundaryUtcMs(year: number, monthIndex: number, day: number, hour: number): number {
  return Date.UTC(year, monthIndex, day, hour, 0, 0, 0) - BDT_OFFSET_MS;
}

function splitDutySegments(startTime: Date, endTime: Date, configs: ShiftConfigRow[]): DutySegment[] {
  const startMs = startTime.getTime();
  const endMs = endTime.getTime();
  if (endMs <= startMs) return [];

  const startBdt = toBdtDate(startTime);
  const endBdt = toBdtDate(endTime);
  const boundaries = new Set<number>([startMs, endMs]);
  const firstDay = Date.UTC(startBdt.getUTCFullYear(), startBdt.getUTCMonth(), startBdt.getUTCDate() - 1);
  const lastDay = Date.UTC(endBdt.getUTCFullYear(), endBdt.getUTCMonth(), endBdt.getUTCDate() + 1);

  for (let dayMs = firstDay; dayMs <= lastDay; dayMs += 24 * 60 * 60 * 1000) {
    const day = new Date(dayMs);
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth();
    const d = day.getUTCDate();
    boundaries.add(bdtBoundaryUtcMs(y, m, d, 0));
    for (const row of configs) {
      if (!["Evening", "Night", "Midnight"].includes(row.shiftName)) continue;
      const endHour = normalizeEndHour(row.startHour, row.endHour);
      boundaries.add(bdtBoundaryUtcMs(y, m, d, row.startHour));
      boundaries.add(bdtBoundaryUtcMs(y, m, d + (endHour <= row.startHour ? 1 : 0), endHour));
    }
  }

  const points = [...boundaries].filter(ms => ms >= startMs && ms <= endMs).sort((a, b) => a - b);
  const segments: DutySegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    const durationSeconds = Math.round((segEnd - segStart) / 1000);
    if (durationSeconds <= 0) continue;
    const midpoint = new Date(segStart + Math.floor((segEnd - segStart) / 2));
    const segmentStart = new Date(segStart);
    segments.push({
      shiftType: getBdtShiftType(midpoint, configs),
      weekStart: getBdtWeekStart(segmentStart),
      logDate: getBdtLogDate(segmentStart),
      durationSeconds,
    });
  }
  return segments;
}

function dateToSnowflake(date: Date): string {
  const DISCORD_EPOCH = 1420070400000n;
  return ((BigInt(date.getTime()) - DISCORD_EPOCH) << 22n).toString();
}

function getBackfillStartDate(): Date {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - BACKFILL_MONTHS);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function bdtDateStringToUtcDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - BDT_OFFSET_MS);
}

function isBotGeneratedNote(note: string | null | undefined): boolean {
  return note === "Backfill via Discord bot" || note === "Auto-logged via Discord bot";
}

const DUTY_REGEX = /(.+?)\s+\[\w+\]\s+\(license:([a-f0-9]+)\)\s+went\s+(on|off)-duty/i;
const EMBED_ON_RE  = /10[-–]41|went\s+on[-–]duty|beginning\s+tour|on\s+duty/i;
const EMBED_OFF_RE = /10[-–]42|went\s+off[-–]duty|end\s+of\s+shift|off\s+duty/i;

function extractText(message: Message): string {
  const parts: string[] = [];
  if (message.content) parts.push(message.content);
  for (const embed of message.embeds) {
    if (embed.title) parts.push(embed.title);
    if (embed.description) parts.push(embed.description);
    if (embed.author?.name) parts.push(embed.author.name);
    for (const field of embed.fields) parts.push(field.name + " " + field.value);
  }
  return parts.join("\n");
}

type ParseResult =
  | { action: "on" | "off"; license: string }
  | null;

function parseMessage(text: string): ParseResult {
  const match = /license:([a-z0-9]+)[\s\S]*?\bwent\s+(on|off)[-\u2013\u2014]duty/i.exec(text);
  if (match) {
    const action = match[2].toLowerCase() === "on" ? "on" : "off";
    return { action, license: normalize(match[1]) };
  }
  const license = (() => {
    const m = /license:([a-z0-9]+)/i.exec(text);
    return m ? normalize(m[1]) : null;
  })();
  if (!license) return null;
  if (/10[-\u2013\u2014]42|went\s+off[-\u2013\u2014]duty|end\s+of\s+shift|off\s+duty/i.test(text)) return { action: "off", license };
  if (/10[-\u2013\u2014]41|went\s+on[-\u2013\u2014]duty|beginning\s+tour|on\s+duty/i.test(text)) return { action: "on", license };
  return null;
}

async function getMemberByLicense(license: string) {
  const members = await db
    .select({ id: membersTable.id, name: membersTable.name, licenseKey: membersTable.licenseKey })
    .from(membersTable);
  return members.find((member) => normalize(member.licenseKey) === normalize(license)) ?? null;
}

async function insertDutyLog(
  memberId: number,
  startTime: Date,
  durationSeconds: number,
  note: string,
  existingSet?: Set<string>,
  shiftConfigs?: ShiftConfigRow[],
) {
  const endTime = new Date(startTime.getTime() + durationSeconds * 1000);
  const configs = shiftConfigs ?? await loadShiftConfigs();
  const segments = splitDutySegments(startTime, endTime, configs);
  const inserted: DutySegment[] = [];

  for (const segment of segments) {
    const dedupKey = `${memberId}:${segment.logDate}:${segment.shiftType}:${segment.durationSeconds}`;
    if (existingSet?.has(dedupKey)) continue;
    await db.insert(dutyLogsTable).values({
      memberId,
      weekStart: segment.weekStart,
      shiftType: segment.shiftType,
      durationMinutes: segment.durationSeconds,
      logDate: segment.logDate,
      notes: note,
    });
    existingSet?.add(dedupKey);
    inserted.push(segment);
  }

  return inserted;
}

async function processMessage(message: Message): Promise<void> {
  const text = extractText(message);
  if (!text.trim()) return;
  const parsed = parseMessage(text);
  if (!parsed) return;

  const { action, license } = parsed;
  const now = message.createdAt;

  if (action === "on") {
    const member = await getMemberByLicense(license);
    if (!member) {
      console.log(`[BOT] ⚠️  No member for license ${license} — add in Admin Panel → License Key`);
      return;
    }
    activeSessions.set(license, { startTime: now, memberId: member.id, playerName: member.name });
    await db.insert(activeDutySessionsTable).values({
      memberId: member.id,
      licenseKey: license,
      playerName: member.name,
      startTime: now,
    }).onDuplicateKeyUpdate({
      set: { memberId: member.id, playerName: member.name, startTime: now },
    });
    console.log(`[BOT] ✅ ON-DUTY  — ${member.name} at ${now.toISOString()}`);
  } else {
    const session = activeSessions.get(license);
    if (!session) {
      console.log(`[BOT] ⚠️  OFF-DUTY but no active session for license ${license}`);
      return;
    }
    activeSessions.delete(license);
    await db.delete(activeDutySessionsTable).where(eq(activeDutySessionsTable.licenseKey, license));
    const duration = Math.max(1, Math.round((now.getTime() - session.startTime.getTime()) / 1000));
    const segments = await insertDutyLog(session.memberId, session.startTime, duration, "Auto-logged via Discord bot");
    const segmentLabel = segments.map(s => `${s.shiftType}:${s.durationSeconds}s`).join(", ") || "no shift segment";
    const weekStart = segments[0]?.weekStart ?? getBdtWeekStart(session.startTime);
    const h = Math.floor(duration / 3600), m = Math.floor((duration % 3600) / 60), s = duration % 60;
    console.log(`[BOT] ✅ LOGGED   — ${session.playerName}: ${h}h ${m}m ${s}s (${segmentLabel}) week ${weekStart}`);
  }
}

async function runBackfill(channel: TextChannel): Promise<void> {
  console.log(`[BACKFILL] Starting BDT shift-split import from the past ${BACKFILL_MONTHS} month(s)...`);

  let backfillFrom = getBackfillStartDate();

  if (REBUILD_BACKFILL) {
    const backfillFromDate = getBdtLogDate(backfillFrom);
    const deletedRows = await db.select({ id: dutyLogsTable.id })
      .from(dutyLogsTable)
      .where(and(
        gte(dutyLogsTable.logDate, backfillFromDate),
        inArray(dutyLogsTable.notes, ["Backfill via Discord bot", "Auto-logged via Discord bot"]),
      ));
    if (deletedRows.length > 0) {
      await db.delete(dutyLogsTable)
        .where(and(
          gte(dutyLogsTable.logDate, backfillFromDate),
          inArray(dutyLogsTable.notes, ["Backfill via Discord bot", "Auto-logged via Discord bot"]),
        ));
    }
    console.log(`[BACKFILL] Rebuild mode: removed ${deletedRows.length} bot-generated duty log(s) since ${backfillFromDate}.`);
  }

  const existingLogs = await db.select({
    memberId: dutyLogsTable.memberId,
    logDate: dutyLogsTable.logDate,
    shiftType: dutyLogsTable.shiftType,
    durationMinutes: dutyLogsTable.durationMinutes,
    notes: dutyLogsTable.notes,
  }).from(dutyLogsTable);

  if (!REBUILD_BACKFILL) {
    const latestBotLogDate = existingLogs
      .filter(l => isBotGeneratedNote(l.notes))
      .map(l => l.logDate)
      .sort()
      .at(-1);
    if (latestBotLogDate) {
      const catchupFrom = bdtDateStringToUtcDate(latestBotLogDate);
      catchupFrom.setUTCDate(catchupFrom.getUTCDate() - BACKFILL_OVERLAP_DAYS);
      if (catchupFrom > backfillFrom) backfillFrom = catchupFrom;
    }
  }
  console.log(`[BACKFILL] Catch-up scan starts at ${backfillFrom.toISOString()} (${getBdtLogDate(backfillFrom)} BDT).`);

  const existingSet = new Set(
    existingLogs.map(l => `${l.memberId}:${l.logDate}:${l.shiftType}:${l.durationMinutes}`)
  );
  const shiftConfigs = await loadShiftConfigs();

  const allMembers = await db.select({ id: membersTable.id, name: membersTable.name, licenseKey: membersTable.licenseKey }).from(membersTable);
  const licenseMap = new Map<string, { id: number; name: string }>();
  for (const m of allMembers) {
    const license = normalize(m.licenseKey);
    if (license) licenseMap.set(license, { id: m.id, name: m.name });
  }

  const localSessions = new Map<string, { startTime: Date; memberId: number; playerName: string }>();
  let afterId = dateToSnowflake(backfillFrom);
  let totalMessages = 0;
  let totalLogged = 0;
  let totalSegments = 0;
  let totalSkipped = 0;
  let hasMore = true;
  const startedAt = Date.now();

  while (hasMore) {
    const batch = await channel.messages.fetch({ after: afterId, limit: 100 });
    if (batch.size === 0) { hasMore = false; break; }

    const sorted = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    totalMessages += sorted.length;

    for (const msg of sorted) {
      const text = extractText(msg);
      if (!text.trim()) continue;
      const parsed = parseMessage(text);
      if (!parsed) continue;

      const { action, license } = parsed;
      const ts = msg.createdAt;

      if (action === "on") {
        const member = licenseMap.get(license);
        if (!member) continue;
        localSessions.set(license, { startTime: ts, memberId: member.id, playerName: member.name });
      } else if (action === "off") {
        const session = localSessions.get(license);
        if (!session) continue;
        localSessions.delete(license);

        const duration = Math.max(1, Math.round((ts.getTime() - session.startTime.getTime()) / 1000));
        const logDate = getBdtLogDate(session.startTime);
        const segments = await insertDutyLog(session.memberId, session.startTime, duration, "Backfill via Discord bot", existingSet, shiftConfigs);
        if (segments.length === 0) {
          totalSkipped++;
          continue;
        }

        const weekStart = segments[0]?.weekStart ?? getBdtWeekStart(session.startTime);
        const segmentLabel = segments.map(s => `${s.shiftType}:${s.durationSeconds}s`).join(", ");
        const h = Math.floor(duration / 3600), m = Math.floor((duration % 3600) / 60), s = duration % 60;
        console.log(`[BACKFILL] ✅ ${session.playerName}: ${h}h ${m}m ${s}s (${segmentLabel}) ${logDate} week ${weekStart}`);
        totalLogged++;
        totalSegments += segments.length;
      }
    }

    afterId = sorted[sorted.length - 1].id;
    if (batch.size < 100) hasMore = false;
    if (BACKFILL_PAGE_DELAY_MS > 0) {
      await new Promise(r => setTimeout(r, BACKFILL_PAGE_DELAY_MS));
    }
  }

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[BACKFILL] Done. ${totalMessages} messages scanned, ${totalLogged} sessions logged, ${totalSegments} shift segment(s), ${totalSkipped} duplicate session(s) skipped, ${elapsedSeconds}s elapsed.`);

  // Restore any currently open sessions (ON with no matching OFF)
  if (localSessions.size > 0) {
    console.log(`[BACKFILL] 🔄 Restoring ${localSessions.size} active duty session(s)...`);
    for (const [license, session] of localSessions) {
      try {
        await db.insert(activeDutySessionsTable).values({
          memberId: session.memberId,
          licenseKey: license,
          playerName: session.playerName,
          startTime: session.startTime,
        }).onDuplicateKeyUpdate({
          set: {
            memberId: session.memberId,
            playerName: session.playerName,
            startTime: session.startTime,
          },
        });
        // Also seed the in-memory map so OFF messages work correctly
        activeSessions.set(license, session);
        const elapsed = Math.round((Date.now() - session.startTime.getTime()) / 1000);
        const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60);
        console.log(`[BACKFILL] ✅ Active — ${session.playerName} (on duty ${h}h ${m}m)`);
      } catch (err) {
        console.error(`[BACKFILL] ❌ Failed to restore session for ${session.playerName}:`, err);
      }
    }
    console.log(`[BACKFILL] ✅ Active sessions restored.`);
  } else {
    console.log("[BACKFILL] No open sessions to restore.");
  }
}

async function rebuildCurrentActiveSessions(channel: TextChannel): Promise<number> {
  console.log(`[ACTIVE] Rebuilding current on-duty sessions from latest ${CURRENT_SCAN_LIMIT} timestamp messages...`);

  const allMembers = await db.select({ id: membersTable.id, name: membersTable.name, licenseKey: membersTable.licenseKey }).from(membersTable);
  const licenseMap = new Map<string, { id: number; name: string }>();
  for (const member of allMembers) {
    const license = normalize(member.licenseKey);
    if (license) licenseMap.set(license, { id: member.id, name: member.name });
  }

  const messages: Message[] = [];
  let before: string | undefined;
  while (messages.length < CURRENT_SCAN_LIMIT) {
    const batch = await channel.messages.fetch({
      before,
      limit: Math.min(100, CURRENT_SCAN_LIMIT - messages.length),
    });
    if (batch.size === 0) break;

    const page = [...batch.values()];
    messages.push(...page);
    before = page[page.length - 1].id;
    if (batch.size < 100) break;
    if (BACKFILL_PAGE_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, BACKFILL_PAGE_DELAY_MS));
    }
  }

  const latestSyncedTimestamp = messages.reduce((max, message) => Math.max(max, message.createdTimestamp), 0);
  const localSessions = new Map<string, { startTime: Date; memberId: number; playerName: string }>();
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  for (const message of sorted) {
    const parsed = parseMessage(extractText(message));
    if (!parsed) continue;

    if (parsed.action === "on") {
      const member = licenseMap.get(parsed.license);
      if (member) {
        localSessions.set(parsed.license, {
          startTime: message.createdAt,
          memberId: member.id,
          playerName: member.name,
        });
      }
    } else {
      localSessions.delete(parsed.license);
    }
  }

  await db.delete(activeDutySessionsTable);
  activeSessions.clear();

  for (const [license, session] of localSessions) {
    await db.insert(activeDutySessionsTable).values({
      memberId: session.memberId,
      licenseKey: license,
      playerName: session.playerName,
      startTime: session.startTime,
    }).onDuplicateKeyUpdate({
      set: {
        memberId: session.memberId,
        playerName: session.playerName,
        startTime: session.startTime,
      },
    });
    activeSessions.set(license, session);
  }

  console.log(`[ACTIVE] Restored ${localSessions.size} current on-duty session(s).`);
  return latestSyncedTimestamp;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[BOT] 🟢 Logged in as ${c.user.tag}`);
  console.log(`[BOT] 👁  Watching channel ID: ${CHANNEL_ID}`);

  try {
    const channel = await c.channels.fetch(CHANNEL_ID!);
    if (!channel || !channel.isTextBased()) {
      console.error("[BACKFILL] Could not fetch channel or channel is not text-based");
      return;
    }
    await runBackfill(channel as TextChannel);
    const latestSyncedTimestamp = await rebuildCurrentActiveSessions(channel as TextChannel);
    startupSyncComplete = true;
    if (pendingLiveMessages.length > 0) {
      const queued = pendingLiveMessages
        .splice(0)
        .filter((message) => message.createdTimestamp > latestSyncedTimestamp)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      console.log(`[BOT] Processing ${queued.length} queued live message(s) after startup catch-up...`);
      for (const message of queued) await processMessage(message);
    }
    console.log("[BOT] ✅ Startup catch-up complete. Live tracking is active.");
  } catch (err) {
    console.error("[BOT] Error during startup sync:", err);
    startupSyncComplete = true;
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.channelId !== CHANNEL_ID) return;
  try {
    if (!startupSyncComplete) {
      pendingLiveMessages.push(message);
      return;
    }
    await processMessage(message);
  } catch (err) {
    console.error("[BOT] Error processing message:", err);
  }
});

client.login(BOT_TOKEN);
