import { Router, type IRouter } from "express";
import { db, membersTable, dutyLogsTable, licensesTable, activeDutySessionsTable, shiftConfigTable } from "@workspace/db";
import { splitActiveDutySessionsByFreshness } from "../lib/active-duty";

const router: IRouter = Router();

type ShiftType = "Evening" | "Night" | "Midnight" | "Full";
type DutyStatsLog = {
  memberId: number;
  weekStart: string;
  shiftType: ShiftType;
  durationMinutes: number;
  logDate: string;
};
type ShiftConfigRow = { shiftName: string; startHour: number; endHour: number };
const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;

const RANK_ORDER = [
  "Director", "Deputy Director", "Assistant Director", "Captain",
  "Lieutenant", "Sergeant First Class", "Sergeant",
  "Senior Specialist", "Specialist",
  "Senior Paramedic", "Paramedic", "EMT", "EMS Student",
];

function rankIndex(rank: string): number {
  const idx = RANK_ORDER.indexOf(rank.trim());
  return idx === -1 ? 99 : idx;
}

function parseCallSign(callSign: string) {
  const normalized = callSign.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]+)[-\s]?(\d+)$/);

  if (!match) {
    return {
      prefix: normalized,
      number: Number.POSITIVE_INFINITY,
      fallback: normalized,
    };
  }

  return {
    prefix: match[1],
    number: Number.parseInt(match[2], 10),
    fallback: normalized,
  };
}

function compareByRankAndCallSign(
  a: { rank: string; callSign: string; name?: string },
  b: { rank: string; callSign: string; name?: string }
): number {
  const rankDiff = rankIndex(a.rank) - rankIndex(b.rank);
  if (rankDiff !== 0) return rankDiff;

  const aCallSign = parseCallSign(a.callSign);
  const bCallSign = parseCallSign(b.callSign);
  const prefixDiff = aCallSign.prefix.localeCompare(bCallSign.prefix, undefined, { numeric: true });
  if (prefixDiff !== 0) return prefixDiff;

  const numberDiff = aCallSign.number - bCallSign.number;
  if (numberDiff !== 0) return numberDiff;

  const fallbackDiff = aCallSign.fallback.localeCompare(bCallSign.fallback, undefined, { numeric: true });
  if (fallbackDiff !== 0) return fallbackDiff;

  return (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
}

const MIN_WEEKLY_MINUTES = 18000;
const RED_WEEKS_THRESHOLD = 3;

function isWeekEligible(weekStart: string, joinedAt: string | null | undefined): boolean {
  if (!joinedAt) return true;
  const weekEnd = bdtBoundaryUtcDate(weekStart, 24 * 6);
  const joinDate = bdtBoundaryUtcDate(joinedAt.split("T")[0], 0);
  return joinDate <= weekEnd;
}

function isCompletedWeek(weekStart: string): boolean {
  const nextWeekStart = bdtBoundaryUtcDate(weekStart, 24 * 7);
  return Date.now() >= nextWeekStart.getTime();
}

function effectiveStatus(
  member: { status: string; joinedAt: string | null },
  memberLogs: { weekStart: string; durationMinutes: number }[],
  weeks: { weekStart: string }[]
): string {
  if (member.status !== "Active") return member.status;
  const eligibleMins = weeks
    .filter(w => isWeekEligible(w.weekStart, member.joinedAt) && isCompletedWeek(w.weekStart))
    .map(w => memberLogs.filter(l => l.weekStart === w.weekStart).reduce((s, l) => s + l.durationMinutes, 0));
  const recentMins = eligibleMins.slice(0, RED_WEEKS_THRESHOLD);
  const autoInactive = recentMins.length >= RED_WEEKS_THRESHOLD && recentMins.every(m => m < MIN_WEEKLY_MINUTES);
  return autoInactive ? "Inactive" : "Active";
}

function getMondayWeekStart(date?: Date): string {
  const d = toBdtDate(date ? new Date(date) : new Date());
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function buildWeeks(count = 5): { weekStart: string; weekLabel: string }[] {
  const now = toBdtDate(new Date());
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  const weeks = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(monday);
    start.setUTCDate(monday.getUTCDate() - i * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const pad = (n: number) => String(n).padStart(2, "0");
    const sm = pad(start.getUTCMonth() + 1), sd = pad(start.getUTCDate());
    const em = pad(end.getUTCMonth() + 1), ed = pad(end.getUTCDate());
    const ws = `${start.getUTCFullYear()}-${sm}-${sd}`;
    weeks.push({ weekStart: ws, weekLabel: `${sm}/${sd} - ${em}/${ed}` });
  }
  return weeks;
}
function getCurrentWeekStart(): string {
  return getMondayWeekStart();
}

function toBdtDate(date: Date): Date {
  return new Date(date.getTime() + BDT_OFFSET_MS);
}

function getBdtDateString(date: Date): string {
  const bdt = toBdtDate(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${bdt.getUTCFullYear()}-${pad(bdt.getUTCMonth() + 1)}-${pad(bdt.getUTCDate())}`;
}

function bdtBoundaryUtcMs(year: number, monthIndex: number, day: number, hour: number): number {
  return Date.UTC(year, monthIndex, day, hour, 0, 0, 0) - BDT_OFFSET_MS;
}

function bdtBoundaryUtcDate(dateString: string, hour: number): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(bdtBoundaryUtcMs(year, month - 1, day, hour));
}

function normalizeEndHour(startHour: number, endHour: number): number {
  return endHour === 0 && startHour > 0 ? 24 : endHour;
}

function getShiftTypeForHour(
  startHour: number,
  configs: ShiftConfigRow[]
): ShiftType {
  for (const row of configs) {
    if (!["Evening", "Night", "Midnight"].includes(row.shiftName)) continue;
    const shiftName = row.shiftName as ShiftType;
    const endHour = normalizeEndHour(row.startHour, row.endHour);
    if (row.startHour < endHour) {
      if (startHour >= row.startHour && startHour < endHour) return shiftName;
    } else if (startHour >= row.startHour || startHour < endHour) {
      return shiftName;
    }
  }
  if (startHour >= 20 && startHour < 22) return "Evening";
  if (startHour >= 22) return "Night";
  if (startHour >= 0 && startHour < 2) return "Midnight";
  return "Full";
}

function getBdtShiftType(date: Date, configs: ShiftConfigRow[]): ShiftType {
  return getShiftTypeForHour(toBdtDate(date).getUTCHours(), configs);
}

function splitRunningSession(memberId: number, startTime: Date, endTime: Date, configs: ShiftConfigRow[]): DutyStatsLog[] {
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
  const logs: DutyStatsLog[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    const duration = Math.floor((segEnd - segStart) / 1000);
    if (duration <= 0) continue;
    const start = new Date(segStart);
    const midpoint = new Date(segStart + Math.floor((segEnd - segStart) / 2));
    logs.push({
      memberId,
      weekStart: getMondayWeekStart(start),
      shiftType: getBdtShiftType(midpoint, configs),
      durationMinutes: duration,
      logDate: getBdtDateString(start),
    });
  }
  return logs;
}

async function getDutyStatsLogs(includeRunning = false): Promise<DutyStatsLog[]> {
  const logs = await db.select({
    memberId: dutyLogsTable.memberId,
    weekStart: dutyLogsTable.weekStart,
    shiftType: dutyLogsTable.shiftType,
    durationMinutes: dutyLogsTable.durationMinutes,
    logDate: dutyLogsTable.logDate,
  }).from(dutyLogsTable);

  if (!includeRunning) return logs;

  // Keep the raw UTC timestamp here; splitRunningSession handles BDT conversion internally.
  const now = new Date();
  const currentWeekStart = getCurrentWeekStart();
  const currentWeekStartDate = bdtBoundaryUtcDate(currentWeekStart, 0);
  const sessions = await db.select({
    memberId: activeDutySessionsTable.memberId,
    startTime: activeDutySessionsTable.startTime,
  }).from(activeDutySessionsTable);
  const { fresh: freshSessions } = splitActiveDutySessionsByFreshness(sessions);
  const shiftConfigs = await db.select({
    shiftName: shiftConfigTable.shiftName,
    startHour: shiftConfigTable.startHour,
    endHour: shiftConfigTable.endHour,
  }).from(shiftConfigTable);
  const runningLogs = freshSessions.flatMap((session): DutyStatsLog[] => {
    const effectiveStart = session.startTime > currentWeekStartDate ? session.startTime : currentWeekStartDate;
    return splitRunningSession(session.memberId, effectiveStart, now, shiftConfigs);
  });

  return [...logs, ...runningLogs];
}

router.get("/stats/dashboard", async (_req, res) => {
  const WEEKS = buildWeeks(5);
  const members = await db.select().from(membersTable);
  const totalMembers = members.length;

  const allLogs = await getDutyStatsLogs(true);
  const currentWeekStart = getCurrentWeekStart();
  const thisWeekLogs = allLogs.filter(l => l.weekStart === currentWeekStart);
  const nowBdt = toBdtDate(new Date());
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisMonthPrefix = `${nowBdt.getUTCFullYear()}-${pad(nowBdt.getUTCMonth() + 1)}-`;
  const thisMonthLogs = allLogs.filter(l => l.logDate.startsWith(thisMonthPrefix));
  const totalDutyHoursThisWeek = Math.floor(thisWeekLogs.reduce((s, l) => s + l.durationMinutes, 0) / 3600);
  const totalDutyHoursThisMonth = Math.floor(thisMonthLogs.reduce((s, l) => s + l.durationMinutes, 0) / 3600);

  // Compute effective status using the same auto-inactive rule as the Roster page
  const memberEffectiveStatus = new Map<number, string>();
  for (const m of members) {
    const mLogs = allLogs.filter(l => l.memberId === m.id);
    memberEffectiveStatus.set(m.id, effectiveStatus(m, mLogs, WEEKS));
  }

  const activeMembers  = [...memberEffectiveStatus.values()].filter(s => s === "Active").length;
  const loaMembers     = [...memberEffectiveStatus.values()].filter(s => s === "LOA").length;
  const vacantMembers  = [...memberEffectiveStatus.values()].filter(s => s === "Vacant").length;
  const inactiveMembers = [...memberEffectiveStatus.values()].filter(s => s === "Inactive").length;

  // Per-status duty hours this week (using effective status)
  const activeMemberIds   = new Set(members.filter(m => memberEffectiveStatus.get(m.id) === "Active").map(m => m.id));
  const loaMemberIds      = new Set(members.filter(m => memberEffectiveStatus.get(m.id) === "LOA").map(m => m.id));
  const inactiveMemberIds = new Set(members.filter(m => memberEffectiveStatus.get(m.id) === "Inactive").map(m => m.id));
  const activeDutyHoursThisWeek   = Math.floor(thisWeekLogs.filter(l => activeMemberIds.has(l.memberId)).reduce((s, l) => s + l.durationMinutes, 0) / 3600);
  const loaDutyHoursThisWeek      = Math.floor(thisWeekLogs.filter(l => loaMemberIds.has(l.memberId)).reduce((s, l) => s + l.durationMinutes, 0) / 3600);
  const inactiveDutyHoursThisWeek = Math.floor(thisWeekLogs.filter(l => inactiveMemberIds.has(l.memberId)).reduce((s, l) => s + l.durationMinutes, 0) / 3600);

  // Top performers this week
  const memberWeekMinutes: Record<number, number> = {};
  for (const log of thisWeekLogs) {
    memberWeekMinutes[log.memberId] = (memberWeekMinutes[log.memberId] || 0) + log.durationMinutes;
  }
  const topPerformersWeekly = Object.entries(memberWeekMinutes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([mid, mins]) => {
      const m = members.find(m => m.id === Number(mid));
      return { name: m?.name ?? "Unknown", callSign: m?.callSign ?? "?", minutes: mins };
    });
  const topPerformerThisWeek = topPerformersWeekly[0]?.name ?? null;

  // Top performers previous week
  const prevWeekStart = WEEKS[1]?.weekStart ?? null;
  const prevWeekLabel = WEEKS[1]?.weekLabel ?? null;
  const prevWeekLogs = prevWeekStart ? allLogs.filter(l => l.weekStart === prevWeekStart) : [];
  const memberPrevWeekMinutes: Record<number, number> = {};
  for (const log of prevWeekLogs) {
    memberPrevWeekMinutes[log.memberId] = (memberPrevWeekMinutes[log.memberId] || 0) + log.durationMinutes;
  }
  const topPerformersPreviousWeek = Object.entries(memberPrevWeekMinutes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([mid, mins]) => {
      const m = members.find(m => m.id === Number(mid));
      return { name: m?.name ?? "Unknown", callSign: m?.callSign ?? "?", minutes: mins };
    });

  // Top performers this month
  const memberMonthMinutes: Record<number, number> = {};
  for (const log of thisMonthLogs) {
    memberMonthMinutes[log.memberId] = (memberMonthMinutes[log.memberId] || 0) + log.durationMinutes;
  }
  const topPerformersMonthly = Object.entries(memberMonthMinutes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([mid, mins]) => {
      const m = members.find(m => m.id === Number(mid));
      return { name: m?.name ?? "Unknown", callSign: m?.callSign ?? "?", minutes: mins };
    });

  // Peak hour week
  const weekTotals = WEEKS.map(week => {
    const total = allLogs.filter(l => l.weekStart === week.weekStart).reduce((s, l) => s + l.durationMinutes, 0);
    return { weekLabel: week.weekLabel, totalMinutes: total };
  });
  const peakWeek = weekTotals.sort((a, b) => b.totalMinutes - a.totalMinutes)[0] ?? null;
  const peakHourWeekLabel = peakWeek?.weekLabel ?? null;
  const peakHourWeekMinutes = peakWeek?.totalMinutes ?? 0;

  // Rank breakdown
  const rankCount: Record<string, number> = {};
  for (const m of members) {
    rankCount[m.rank] = (rankCount[m.rank] || 0) + 1;
  }
  const rankBreakdown = Object.entries(rankCount)
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank));

  const licenses = await db.select().from(licensesTable);
  const uniqueLicensesTracked = licenses.length;

  // Build inactive personnel list (includes auto-inactive by 3 red weeks)
  const inactivePersonnel = members
    .filter(m => memberEffectiveStatus.get(m.id) === "Inactive")
    .map(m => {
      const mLogs = allLogs.filter(l => l.memberId === m.id);
      const redWeeks = WEEKS
        .filter(w => isWeekEligible(w.weekStart, m.joinedAt) && isCompletedWeek(w.weekStart))
        .map(w => mLogs.filter(l => l.weekStart === w.weekStart).reduce((s, l) => s + l.durationMinutes, 0))
        .filter(mins => mins < MIN_WEEKLY_MINUTES)
        .length;
      return { id: m.id, name: m.name, callSign: m.callSign, rank: m.rank, redWeeks };
    })
    .sort((a, b) => b.redWeeks - a.redWeeks);

  res.json({
    totalMembers,
    activeMembers,
    loaMembers,
    vacantMembers,
    inactiveMembers,
    totalDutyHoursThisWeek,
    totalDutyHoursThisMonth,
    activeDutyHoursThisWeek,
    loaDutyHoursThisWeek,
    inactiveDutyHoursThisWeek,
    topPerformerThisWeek,
    topPerformersWeekly,
    topPerformersPreviousWeek,
    topPerformersMonthly,
    currentWeekLabel: WEEKS[0]?.weekLabel ?? null,
    prevWeekLabel,
    peakHourWeekLabel,
    peakHourWeekMinutes,
    rankBreakdown,
    uniqueLicensesTracked,
    inactivePersonnel,
  });
});

router.get("/stats/roster", async (_req, res) => {
  const WEEKS = buildWeeks(5);
  const members = await db.select().from(membersTable);
  const allLogs = await getDutyStatsLogs(true);

  const roster = members.map(member => {
    const memberLogs = allLogs.filter(l => l.memberId === member.id);
    let totalMonthMinutes = 0;

    const weeks = WEEKS.map(week => {
      const weekLogs = memberLogs.filter(l => l.weekStart === week.weekStart);
      const total = weekLogs.reduce((s, l) => s + l.durationMinutes, 0);
      totalMonthMinutes += total;
      return {
        weekStart: week.weekStart,
        weekLabel: week.weekLabel,
        totalMinutes: total,
      };
    });

    return {
      id: member.id,
      callSign: member.callSign,
      name: member.name,
      status: member.status,
      rank: member.rank,
      joinedAt: member.joinedAt ?? null,
      weeks,
      totalMonthMinutes,
    };
  });

  roster.sort(compareByRankAndCallSign);

  res.json(roster);
});

router.get("/stats/shift-roster", async (_req, res) => {
  const WEEKS = buildWeeks(5);
  const members = await db.select().from(membersTable);
  const allLogs = await getDutyStatsLogs(true);

  // Calendar-month helpers
  const now = toBdtDate(new Date());
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisCalYear  = now.getUTCFullYear();
  const thisCalMonth = now.getUTCMonth() + 1;
  const prevCalYear  = thisCalMonth === 1 ? thisCalYear - 1 : thisCalYear;
  const prevCalMonth = thisCalMonth === 1 ? 12 : thisCalMonth - 1;
  const thisCalPrefix = `${thisCalYear}-${pad(thisCalMonth)}-`;
  const prevCalPrefix = `${prevCalYear}-${pad(prevCalMonth)}-`;
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const thisMonthName = MONTH_NAMES[thisCalMonth - 1];
  const prevMonthName = MONTH_NAMES[prevCalMonth - 1];

  const shiftRoster = members.map(member => {
    const memberLogs = allLogs.filter(l => l.memberId === member.id);

    let monthEvening = 0;
    let monthNight = 0;
    let monthMidnight = 0;
    let monthFull = 0;

    const weeks = WEEKS.map(week => {
      const weekLogs = memberLogs.filter(l => l.weekStart === week.weekStart);
      const eveningMinutes = weekLogs.filter(l => l.shiftType === "Evening").reduce((s, l) => s + l.durationMinutes, 0);
      const nightMinutes = weekLogs.filter(l => l.shiftType === "Night").reduce((s, l) => s + l.durationMinutes, 0);
      const midnightMinutes = weekLogs.filter(l => l.shiftType === "Midnight").reduce((s, l) => s + l.durationMinutes, 0);
      const fullMinutes = weekLogs.filter(l => l.shiftType === "Full").reduce((s, l) => s + l.durationMinutes, 0);
      const totalMinutes = eveningMinutes + nightMinutes + midnightMinutes + fullMinutes;

      monthEvening += eveningMinutes;
      monthNight += nightMinutes;
      monthMidnight += midnightMinutes;
      monthFull += fullMinutes;

      return {
        weekStart: week.weekStart,
        weekLabel: week.weekLabel,
        eveningMinutes,
        nightMinutes,
        midnightMinutes,
        fullMinutes,
        totalMinutes,
      };
    });

    // Calendar-month totals by actual logDate
    const calSum = (prefix: string) => {
      const logs = memberLogs.filter(l => l.logDate.startsWith(prefix));
      return {
        total:   logs.reduce((s, l) => s + l.durationMinutes, 0),
        evening: logs.filter(l => l.shiftType === "Evening").reduce((s, l) => s + l.durationMinutes, 0),
        night:   logs.filter(l => l.shiftType === "Night").reduce((s, l) => s + l.durationMinutes, 0),
        midnight:logs.filter(l => l.shiftType === "Midnight").reduce((s, l) => s + l.durationMinutes, 0),
        full:    logs.filter(l => l.shiftType === "Full").reduce((s, l) => s + l.durationMinutes, 0),
      };
    };
    const thisCal = calSum(thisCalPrefix);
    const prevCal = calSum(prevCalPrefix);

    return {
      id: member.id,
      callSign: member.callSign,
      name: member.name,
      status: member.status,
      rank: member.rank,
      joinedAt: member.joinedAt ?? null,
      weeks,
      monthEvening,
      monthNight,
      monthMidnight,
      monthFull,
      monthTotal: monthEvening + monthNight + monthMidnight + monthFull,
      // calendar month totals
      thisCalTotal: thisCal.total, thisCalEvening: thisCal.evening, thisCalNight: thisCal.night, thisCalMidnight: thisCal.midnight, thisCalFull: thisCal.full,
      prevCalTotal: prevCal.total, prevCalEvening: prevCal.evening, prevCalNight: prevCal.night, prevCalMidnight: prevCal.midnight, prevCalFull: prevCal.full,
    };
  });

  shiftRoster.sort(compareByRankAndCallSign);

  res.json(shiftRoster);
});

// Calendar-month top performers — uses actual logDate, not weekStart
router.get("/stats/monthly-performers", async (req, res) => {
  const now = new Date();
  const year  = parseInt((req.query.year  as string) || String(now.getUTCFullYear()), 10);
  const month = parseInt((req.query.month as string) || String(now.getUTCMonth() + 1), 10);
  const shift = (req.query.shift as string | undefined) ?? "all";

  const pad   = (n: number) => String(n).padStart(2, "0");
  const prefix = `${year}-${pad(month)}-`;           // e.g. "2026-04-"

  // last day of requested month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = `${pad(month)}/01 - ${pad(month)}/${pad(lastDay)}`;

  const members = await db.select().from(membersTable);
  const allLogs = await getDutyStatsLogs(true);

  // filter by logDate prefix so we only count logs whose actual date is in this month
  const monthLogs = allLogs.filter(l => l.logDate.startsWith(prefix));

  const totals: Record<number, number> = {};
  for (const log of monthLogs) {
    const shiftMatches =
      shift === "all"      ? true :
      shift === "Full"     ? log.shiftType === "Full" :
      shift === "Evening"  ? log.shiftType === "Evening"  :
      shift === "Night"    ? log.shiftType === "Night"    :
      shift === "Midnight" ? log.shiftType === "Midnight" : true;
    if (shiftMatches) {
      totals[log.memberId] = (totals[log.memberId] || 0) + log.durationMinutes;
    }
  }

  const top = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([mid, minutes]) => {
      const m = members.find(m => m.id === Number(mid));
      return { name: m?.name ?? "Unknown", callSign: m?.callSign ?? "?", minutes };
    });

  res.json({ year, month, monthLabel, shift, top });
});

export default router;
