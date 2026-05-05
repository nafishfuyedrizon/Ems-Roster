import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetShiftRoster, getGetShiftRosterQueryKey } from "@workspace/api-client-react";
import { formatMinutes, WEEKS, STATUS_COLORS, MIN_WEEKLY_MINUTES, RED_WEEKS_THRESHOLD, isWeekEligible, isCompletedWeek } from "@/lib/format";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search, Moon, Star, Cloud, Flame, Clock, Trophy, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PersonnelDossierDialog } from "@/components/personnel-dossier-dialog";
import { API_BASE } from "@/lib/api-base";

const SHIFT_TABS = [
  { key: "all", label: "All Shifts", icon: Clock, color: "text-teal-400", bg: "bg-teal-400/10 border-teal-400/30" },
  { key: "Evening", label: "Evening", sublabel: "08PM - 10PM", icon: Moon, color: "text-indigo-400", bg: "bg-indigo-400/10 border-indigo-400/30" },
  { key: "Night", label: "Night", sublabel: "10PM - 12AM", icon: Star, color: "text-violet-400", bg: "bg-violet-400/10 border-violet-400/30" },
  { key: "Midnight", label: "Midnight", sublabel: "12AM - 02AM", icon: Cloud, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  { key: "Full", label: "Full Shift", sublabel: "08PM - 02AM", icon: Flame, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" },
] as const;

const REFRESH_INTERVAL = 1;
type ShiftKey = "all" | "Evening" | "Night" | "Midnight" | "Full";

function getWeekMinutes(entry: any, weekStart: string, shift: ShiftKey): number {
  const week = entry.weeks?.find((w: any) => w.weekStart === weekStart);
  if (!week) return 0;
  if (shift === "all") return week.totalMinutes ?? 0;
  if (shift === "Full") return week.fullMinutes ?? 0;
  if (shift === "Evening") return week.eveningMinutes ?? 0;
  if (shift === "Night") return week.nightMinutes ?? 0;
  if (shift === "Midnight") return week.midnightMinutes ?? 0;
  return 0;
}

function getMonthMinutes(entry: any, shift: ShiftKey): number {
  if (shift === "all") return entry.monthTotal ?? 0;
  if (shift === "Full") return entry.monthFull ?? 0;
  if (shift === "Evening") return entry.monthEvening ?? 0;
  if (shift === "Night") return entry.monthNight ?? 0;
  if (shift === "Midnight") return entry.monthMidnight ?? 0;
  return 0;
}

function getCalMonthMinutes(entry: any, which: "this" | "prev", shift: ShiftKey): number {
  const prefix = which === "this" ? "thisCal" : "prevCal";
  if (shift === "all") return entry[`${prefix}Total`] ?? 0;
  if (shift === "Full") return entry[`${prefix}Full`] ?? 0;
  if (shift === "Evening") return entry[`${prefix}Evening`] ?? 0;
  if (shift === "Night") return entry[`${prefix}Night`] ?? 0;
  if (shift === "Midnight") return entry[`${prefix}Midnight`] ?? 0;
  return 0;
}

const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;
const _now = new Date(Date.now() + BDT_OFFSET_MS);
const THIS_MONTH_NAME = MONTH_NAMES_SHORT[_now.getUTCMonth()];
const PREV_MONTH_NAME = MONTH_NAMES_SHORT[_now.getUTCMonth() === 0 ? 11 : _now.getUTCMonth() - 1];

export default function ShiftRoster() {
  const { data: roster, isLoading, error } = useGetShiftRoster({
    query: {
      queryKey: getGetShiftRosterQueryKey(),
      refetchInterval: REFRESH_INTERVAL * 1000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 0,
    }
  });

  const [search, setSearch] = useState("");
  const [activeShift, setActiveShift] = useState<ShiftKey>("all");
  const [dossierMemberId, setDossierMemberId] = useState<number | null>(null);
  const [weekTab, setWeekTab] = useState<"this" | "prev">("this");
  const [monthTab, setMonthTab] = useState<"this" | "prev">("this");

  // Calendar-month helpers
  const now = new Date(Date.now() + BDT_OFFSET_MS);
  const thisYear  = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth() + 1;
  const prevYear  = thisMonth === 1 ? thisYear - 1 : thisYear;
  const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1;

  const fetchMonthlyPerformers = async (year: number, month: number, shift: ShiftKey) => {
    const r = await fetch(`${API_BASE}/stats/monthly-performers?year=${year}&month=${month}&shift=${shift}`, {
      cache: "no-store",
    });
    if (!r.ok) {
      throw new Error("Failed to load monthly performers");
    }
    return r.json() as Promise<{ monthLabel: string; top: { name: string; callSign: string; minutes: number }[] }>;
  };

  const { data: thisMonthData } = useQuery({
    queryKey: ["monthly-performers", thisYear, thisMonth, activeShift],
    queryFn: () => fetchMonthlyPerformers(thisYear, thisMonth, activeShift),
    refetchInterval: REFRESH_INTERVAL * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
  const { data: prevMonthData } = useQuery({
    queryKey: ["monthly-performers", prevYear, prevMonth, activeShift],
    queryFn: () => fetchMonthlyPerformers(prevYear, prevMonth, activeShift),
    refetchInterval: REFRESH_INTERVAL * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  const filteredRoster = roster?.filter(entry =>
    entry.name.toLowerCase().includes(search.toLowerCase()) ||
    entry.callSign.toLowerCase().includes(search.toLowerCase())
  );

  const activeTab = SHIFT_TABS.find(t => t.key === activeShift)!;

  return (
    <Layout>
      <div className="flex flex-col gap-6">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight uppercase sm:text-3xl">EMS Duty Hours</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              Per-shift duty time breakdown — Weekly &amp; Monthly
            </p>
          </div>
          <div className="relative w-full xl:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by CS or Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
            />
          </div>
        </div>

        {/* Shift Selector Tabs */}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {SHIFT_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeShift === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveShift(tab.key as ShiftKey)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? `${tab.bg} ${tab.color} border-current`
                    : "bg-card/50 border-border/30 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-mono font-semibold uppercase tracking-wider text-xs">{tab.label}</div>
                  {"sublabel" in tab && (
                    <div className="text-[10px] opacity-70 font-mono">{tab.sublabel}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40 inline-block" />
            Completed week &lt; 5h (warning)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/10 border border-red-500/20 inline-block" />
            3+ red weeks → auto Inactive
          </span>
        </div>

        {/* Top Performers */}
        {!isLoading && roster && (() => {
          const MEDALS = ["🥇", "🥈", "🥉", "4.", "5."];

          const thisWeekStart = WEEKS[0].weekStart;
          const prevWeekStart = WEEKS[1]?.weekStart;

          const thisWeekTop = [...roster]
            .map(e => ({ name: e.name, callSign: e.callSign, minutes: getWeekMinutes(e, thisWeekStart, activeShift) }))
            .filter(e => e.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
          const prevWeekTop = prevWeekStart ? [...roster]
            .map(e => ({ name: e.name, callSign: e.callSign, minutes: getWeekMinutes(e, prevWeekStart, activeShift) }))
            .filter(e => e.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 5) : [];

          const weekData = weekTab === "this" ? thisWeekTop : prevWeekTop;
          const weekLabel = weekTab === "this" ? WEEKS[0].weekLabel : (WEEKS[1]?.weekLabel ?? "—");
          const monthData = (monthTab === "this" ? thisMonthData?.top : prevMonthData?.top) ?? [];
          const monthLabel = (monthTab === "this" ? thisMonthData?.monthLabel : prevMonthData?.monthLabel) ?? "—";

          const renderList = (data: typeof weekData) =>
            data.length === 0 ? (
              <p className="text-muted-foreground text-sm font-mono text-center py-4">No duty data yet</p>
            ) : (
              <div className="space-y-1.5">
                {data.map((p, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md",
                      idx === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/20 border border-border/30"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm w-6 shrink-0">{MEDALS[idx]}</span>
                      <span className={cn("font-mono text-xs shrink-0", idx === 0 ? "text-primary" : "text-muted-foreground")}>{p.callSign}</span>
                      <span className={cn("font-medium text-sm truncate", idx === 0 ? "text-foreground" : "text-muted-foreground")}>{p.name}</span>
                    </div>
                    <span className={cn("font-mono text-sm font-bold shrink-0 ml-2", idx === 0 ? "text-primary" : "text-muted-foreground")}>
                      {formatMinutes(p.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            );

          const TabToggle = ({
            value, onChange, opts
          }: { value: "this" | "prev"; onChange: (v: "this" | "prev") => void; opts: [string, string] }) => (
            <div className="flex gap-1 bg-muted/20 rounded p-0.5 border border-border/30">
              {(["this", "prev"] as const).map((v, i) => (
                <button key={v} onClick={() => onChange(v)}
                  className={cn("px-2.5 py-1 text-[10px] font-mono font-semibold rounded transition-all",
                    value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {opts[i]}
                </button>
              ))}
            </div>
          );

          return (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Weekly Panel */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider">
                      <TrendingUp className="w-4 h-4 text-yellow-400" />
                      Top Performers — {weekTab === "this" ? "This Week" : "Previous Week"}
                    </CardTitle>
                    <TabToggle value={weekTab} onChange={setWeekTab} opts={["This Week", "Prev Week"]} />
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">
                    {activeShift === "all" ? "All shifts" : activeTab.label} · {weekLabel}
                  </p>
                </CardHeader>
                <CardContent>{renderList(weekData)}</CardContent>
              </Card>

              {/* Monthly Panel */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      Top Performers — {monthTab === "this" ? "This Month" : "Previous Month"}
                    </CardTitle>
                    <TabToggle value={monthTab} onChange={setMonthTab} opts={["This Month", "Prev Month"]} />
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">
                    {activeShift === "all" ? "All shifts" : activeTab.label} · {monthLabel}
                  </p>
                </CardHeader>
                <CardContent>{renderList(monthData)}</CardContent>
              </Card>
            </div>
          );
        })()}

        {/* Summary Cards */}
        {!isLoading && roster && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(() => {
              const withDuty = roster.filter(e => getMonthMinutes(e, activeShift) > 0).length;
              const totalMonthMinutes = roster.reduce((s, e) => s + getMonthMinutes(e, activeShift), 0);
              return (
                <>
                  <Card className="border-border/30 bg-card/50 col-span-1">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Active Personnel</p>
                      <p className={cn("text-2xl font-bold mt-1", activeTab.color)}>{withDuty}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">with duty logged</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/30 bg-card/50 col-span-1">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Monthly Total</p>
                      <p className={cn("text-2xl font-bold font-mono mt-1", activeTab.color)}>{formatMinutes(totalMonthMinutes)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">all personnel</p>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </div>
        )}

        {/* Table */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4 border-b border-border/30">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <activeTab.icon className={cn("w-3.5 h-3.5", activeTab.color)} />
              {activeShift === "all" ? "All Shifts — Weekly & Monthly Breakdown" : `${activeTab.label} (${(activeTab as any).sublabel}) — Weekly & Monthly`}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-[110px] min-w-[110px] font-mono text-xs uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/30 z-10 whitespace-nowrap">CS</TableHead>
                  <TableHead className="min-w-[150px] font-mono text-xs uppercase tracking-wider text-muted-foreground sticky left-[110px] bg-muted/30 z-10">Name</TableHead>
                  <TableHead className="w-[120px] min-w-[120px] font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</TableHead>
                  <TableHead className="min-w-[160px] font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Rank</TableHead>
                  {WEEKS.map(w => (
                    <TableHead key={w.weekStart} className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {w.label}
                    </TableHead>
                  ))}
                  <TableHead className={cn("text-right font-mono text-xs uppercase tracking-wider whitespace-nowrap border-l border-border/40", "text-emerald-400")}>
                    {THIS_MONTH_NAME} Total
                  </TableHead>
                  <TableHead className={cn("text-right font-mono text-xs uppercase tracking-wider whitespace-nowrap", "text-sky-400")}>
                    {PREV_MONTH_NAME} Total
                  </TableHead>
                  <TableHead className={cn("text-right font-mono text-xs uppercase tracking-wider whitespace-nowrap border-l border-border/40", activeTab.color)}>
                    5-Wk Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/50">
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      {WEEKS.map(w => <TableCell key={w.weekStart} className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>)}
                      <TableCell className="text-right"><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center text-destructive">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 opacity-50" />
                        <p>Failed to load shift roster data.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRoster?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                      No members found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoster?.map((entry) => {
                    const weekData = WEEKS.map(week => {
                      const eligible = isWeekEligible(week.weekStart, entry.joinedAt);
                      const complete = isCompletedWeek(week.weekStart);
                      if (!eligible) return { eligible: false, complete, mins: null };
                      return { eligible: true, complete, mins: getWeekMinutes(entry, week.weekStart, activeShift) };
                    });
                    const isActive = entry.status === "Active";
                    const eligibleMins = weekData.filter(w => w.eligible && w.complete).map(w => w.mins as number);
                    const recentMins = eligibleMins.slice(0, RED_WEEKS_THRESHOLD);
                    const recentRedCount = isActive ? recentMins.filter(m => m < MIN_WEEKLY_MINUTES).length : 0;
                    const hoursInactive = isActive && recentMins.length >= RED_WEEKS_THRESHOLD && recentRedCount >= RED_WEEKS_THRESHOLD;
                    const inactive = entry.status === "Inactive" || hoursInactive;
                    const monthTotal = getMonthMinutes(entry, activeShift);
                    const monthRed = hoursInactive;
                    const displayStatus = hoursInactive ? "Inactive" : entry.status;

                    return (
                      <TableRow
                        key={entry.id}
                        className="border-border/50 transition-colors group hover:bg-white/[0.025]"
                      >
                        <TableCell className={cn("font-mono font-medium sticky left-0 bg-background z-10 whitespace-nowrap w-[110px] min-w-[110px]", activeTab.color)}>
                          {entry.callSign}
                        </TableCell>
                        <TableCell className="font-medium sticky left-[110px] bg-background z-10 whitespace-nowrap min-w-[150px]">
                          <button
                            onClick={() => setDossierMemberId(entry.id)}
                            className="hover:text-primary hover:underline transition-colors text-left"
                          >
                            {entry.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[displayStatus] || "")}>
                            {displayStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{entry.rank}</TableCell>
                        {weekData.map((wd, idx) => {
                          if (!wd.eligible) {
                            return (
                              <TableCell key={WEEKS[idx].weekStart} className="text-right font-mono text-sm text-muted-foreground/20">
                                —
                              </TableCell>
                            );
                          }
                          const mins = wd.mins as number;
                          const isRed = isActive && wd.complete && mins < MIN_WEEKLY_MINUTES;
                          return (
                            <TableCell
                              key={WEEKS[idx].weekStart}
                              className={cn(
                                "text-right font-mono text-sm",
                                isRed ? "text-red-400 bg-red-500/5" : "text-foreground"
                              )}
                            >
                              {formatMinutes(mins)}
                            </TableCell>
                          );
                        })}
                        {/* This calendar month */}
                        {(() => {
                          const mins = getCalMonthMinutes(entry, "this", activeShift);
                          return (
                            <TableCell className="text-right border-l border-border/20">
                              <span className={cn("font-mono text-sm font-semibold", mins > 0 ? "text-emerald-400" : "text-muted-foreground/30")}>
                                {formatMinutes(mins)}
                              </span>
                            </TableCell>
                          );
                        })()}
                        {/* Previous calendar month */}
                        {(() => {
                          const mins = getCalMonthMinutes(entry, "prev", activeShift);
                          return (
                            <TableCell className="text-right">
                              <span className={cn("font-mono text-sm font-semibold", mins > 0 ? "text-sky-400" : "text-muted-foreground/30")}>
                                {formatMinutes(mins)}
                              </span>
                            </TableCell>
                          );
                        })()}
                        {/* 5-week rolling total */}
                        <TableCell className="text-right border-l border-border/20">
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            monthRed ? "text-red-400" : monthTotal > 0 ? activeTab.color : "text-muted-foreground/40"
                          )}>
                            {formatMinutes(monthTotal)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Per-shift monthly breakdown */}
        {!isLoading && roster && activeShift === "all" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "Evening" as ShiftKey, label: "Evening", sub: "08PM-10PM", tab: SHIFT_TABS[1] },
              { key: "Night" as ShiftKey, label: "Night", sub: "10PM-12AM", tab: SHIFT_TABS[2] },
              { key: "Midnight" as ShiftKey, label: "Midnight", sub: "12AM-02AM", tab: SHIFT_TABS[3] },
              { key: "Full" as ShiftKey, label: "Full Shift", sub: "08PM-02AM", tab: SHIFT_TABS[4] },
            ].map(({ key, label, sub, tab }) => {
              const Icon = tab.icon;
              const total = roster.reduce((s, e) => s + getMonthMinutes(e, key), 0);
              const count = roster.filter(e => getMonthMinutes(e, key) > 0).length;
              return (
                <Card
                  key={key}
                  className={cn("border cursor-pointer transition-all hover:scale-[1.02]", tab.bg)}
                  onClick={() => setActiveShift(key)}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn("w-4 h-4", tab.color)} />
                      <span className={cn("text-xs font-mono uppercase font-bold", tab.color)}>{label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{sub}</p>
                    <p className={cn("text-2xl font-bold font-mono mt-2", tab.color)}>{formatMinutes(total)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{count} personnel this month</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      </div>

      <PersonnelDossierDialog
        memberId={dossierMemberId}
        onClose={() => setDossierMemberId(null)}
      />
    </Layout>
  );
}
