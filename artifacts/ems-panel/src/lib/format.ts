export function formatMinutes(seconds: number | undefined | null): string {
  if (typeof seconds !== "number") return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;
function toBdtDate(date: Date): Date {
  return new Date(date.getTime() + BDT_OFFSET_MS);
}

function _buildWeeks(count = 5): { label: string; weekLabel: string; weekStart: string }[] {
  const now = toBdtDate(new Date());
  const day = now.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
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
    weeks.push({ label: `${sm}/${sd}-${em}/${ed}`, weekLabel: `${sm}/${sd} - ${em}/${ed}`, weekStart: ws });
  }
  return weeks;
}
export const WEEKS = _buildWeeks(5);

export const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-500/10 text-green-500 border-green-500/20",
  LOA: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Vacant: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  Inactive: "bg-red-900/20 text-red-400 border-red-800/40",
};

export const RANK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Director":            { bg: "bg-amber-400/15",  text: "text-amber-300",  border: "border-amber-400/30" },
  "Deputy Director":     { bg: "bg-amber-400/10",  text: "text-amber-400",  border: "border-amber-400/25" },
  "Assistant Director":  { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/25" },
  "Captain":             { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/25"  },
  "Lieutenant":          { bg: "bg-sky-500/10",    text: "text-sky-400",    border: "border-sky-500/25"   },
  "Sergeant First Class":{ bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/25"},
  "Sergeant":            { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/25"},
  "Senior Specialist":   { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/25"  },
  "Specialist":          { bg: "bg-teal-500/10",   text: "text-teal-400",   border: "border-teal-500/25"  },
  "Senior Paramedic":    { bg: "bg-emerald-500/10",text: "text-emerald-400",border: "border-emerald-500/25"},
  "Paramedic":           { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/25" },
  "EMT":                 { bg: "bg-lime-500/10",   text: "text-lime-400",   border: "border-lime-500/25"  },
  "EMS Student":         { bg: "bg-muted/30",      text: "text-muted-foreground", border: "border-border/40" },
};

export const EMS_RANKS = [
  "Director",
  "Deputy Director",
  "Assistant Director",
  "Captain",
  "Lieutenant",
  "Sergeant First Class",
  "Sergeant",
  "Senior Specialist",
  "Specialist",
  "Senior Paramedic",
  "Paramedic",
  "EMT",
  "EMS Student",
];

export const SHIFT_LABELS: Record<string, string> = {
  Evening: "Evening Shift 🌙",
  Night: "Night Shift ⭐",
  Midnight: "Midnight Shift 🌛",
  Full: "Full Shift 🔥",
};

export const SHIFT_DURATIONS: Record<string, number> = {
  Evening: 120,
  Night: 120,
  Midnight: 120,
  Full: 480,
};

export const MIN_WEEKLY_MINUTES = 18000;
export const RED_WEEKS_THRESHOLD = 3;

export function countRedWeeks(weekMinutesList: number[]): number {
  return weekMinutesList.filter(m => m < MIN_WEEKLY_MINUTES).length;
}

export function isRowInactive(status: string, redWeeks: number): boolean {
  return status === "Inactive" || redWeeks >= RED_WEEKS_THRESHOLD;
}

export function isWeekEligible(weekStart: string, joinedAt: string | null | undefined): boolean {
  if (!joinedAt) return true;
  const weekEnd = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() - BDT_OFFSET_MS);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const joinDate = new Date(new Date(`${joinedAt.split("T")[0]}T00:00:00Z`).getTime() - BDT_OFFSET_MS);
  return joinDate <= weekEnd;
}

export function isCompletedWeek(weekStart: string): boolean {
  const nextWeekStart = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() - BDT_OFFSET_MS);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
  return Date.now() >= nextWeekStart.getTime();
}
