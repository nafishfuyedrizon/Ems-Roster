import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, Users, Clock, Activity, UserMinus, ShieldAlert, Zap, Radio,
  RefreshCw, Trophy,
} from "lucide-react";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/ems-panel/, "") + "/api";
const REFRESH_INTERVAL = 1;

interface ActiveSession {
  id: number;
  memberId: number;
  licenseKey: string;
  playerName: string;
  startTime: string;
  callSign: string | null;
  rank: string | null;
  name: string | null;
}

interface ActiveDutyResponse {
  count: number;
  sessions: ActiveSession[];
  updatedAt: string;
}

function useActiveDuty() {
  return useQuery<ActiveDutyResponse>({
    queryKey: ["active-duty"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/active-duty?_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch active duty");
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}

function ElapsedTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span className="font-mono text-xs text-green-400 tabular-nums">{formatMinutes(elapsed)}</span>;
}

function RefreshCountdown({ interval, lastRefresh }: { interval: number; lastRefresh: number }) {
  const [remaining, setRemaining] = useState(interval);
  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - lastRefresh) / 1000);
      setRemaining(Math.max(0, interval - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [interval, lastRefresh]);
  return (
    <span className="tabular-nums font-mono text-xs text-muted-foreground">
      Next refresh in {remaining}s
    </span>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading, error } = useGetDashboardStats({
    query: {
      queryKey: getGetDashboardStatsQueryKey(),
      refetchInterval: REFRESH_INTERVAL * 1000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 0,
    }
  });
  const { data: activeDuty, isLoading: dutyLoading, dataUpdatedAt } = useActiveDuty();
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const handleManualRefresh = useCallback(async () => {
    setManualRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["active-duty"] }),
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }),
    ]);
    setTimeout(() => setManualRefreshing(false), 800);
  }, [queryClient]);

  const onDutyCount = activeDuty?.count ?? 0;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight uppercase sm:text-3xl">Command Dashboard</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">Real-time Operational Statistics</p>
          </div>
        </div>

        {error ? (
          <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-md text-destructive flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p>Failed to load dashboard statistics.</p>
          </div>
        ) : (
          <>
            {/* ── LIVE ON DUTY ── */}
            <Card className={cn(
              "bg-card/50 backdrop-blur-sm border transition-colors duration-500",
              onDutyCount > 0 ? "border-green-500/40" : "border-border/40"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                      <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        onDutyCount > 0 ? "bg-green-400" : "bg-gray-500"
                      )} />
                      <span className={cn(
                        "relative inline-flex rounded-full h-3 w-3",
                        onDutyCount > 0 ? "bg-green-500" : "bg-gray-600"
                      )} />
                    </div>
                    <CardTitle className={cn(
                      "uppercase tracking-wider flex items-center gap-2 text-base",
                      onDutyCount > 0 ? "text-green-400" : "text-muted-foreground"
                    )}>
                      <Radio className="w-4 h-4" />
                      Live On Duty
                    </CardTitle>
                    <Badge className={cn(
                      "font-mono text-xs",
                      onDutyCount > 0
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-muted/30 text-muted-foreground border-border/40"
                    )}>
                      {dutyLoading ? "—" : onDutyCount} ON DUTY
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    {dataUpdatedAt > 0 && (
                      <RefreshCountdown interval={REFRESH_INTERVAL} lastRefresh={dataUpdatedAt} />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleManualRefresh}
                      disabled={manualRefreshing}
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", manualRefreshing && "animate-spin")} />
                    </Button>
                    {activeDuty?.updatedAt && (
                      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                        {new Date(activeDuty.updatedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {dutyLoading ? (
                  <div className="flex gap-3 flex-wrap">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-52 rounded-lg" />)}
                  </div>
                ) : !activeDuty?.sessions?.length ? (
                  <div className="text-center py-8 text-muted-foreground font-mono text-sm border border-dashed border-border/30 rounded-lg">
                    <Radio className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No personnel currently on duty
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {activeDuty.sessions.map(session => (
                      <div
                        key={session.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20 min-w-[210px] relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500/60 rounded-l-lg" />
                        <div className="pl-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-primary text-sm font-bold">
                              [{session.callSign ?? "??"}]
                            </span>
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          </div>
                          <div className="font-semibold text-sm text-foreground leading-tight">
                            {session.name ?? session.playerName}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {session.rank ?? "Unknown Rank"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <ElapsedTimer startTime={session.startTime} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── STAT CARDS ── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Members</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="text-2xl font-bold font-mono">{stats?.totalMembers || 0}</div>
                  )}
                  <div className="flex gap-2 mt-2 text-xs font-mono flex-wrap">
                    <span className="text-green-400">{stats?.activeMembers || 0} Active</span>
                    <span className="text-amber-400">{stats?.loaMembers || 0} LOA</span>
                    <span className="text-red-400">{stats ? stats.totalMembers - (stats.activeMembers ?? 0) - (stats.loaMembers ?? 0) - (stats.vacantMembers ?? 0) : 0} Inactive</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Duty Hours</CardTitle>
                  <Clock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-8 w-24" /> : (
                    <div className="text-2xl font-bold font-mono">{stats?.totalDutyHoursThisWeek || 0}h</div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    This week · Month: {stats?.totalDutyHoursThisMonth || 0}h
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Peak Week</CardTitle>
                  <Zap className="h-4 w-4 text-amber-400" />
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-8 w-24" /> : (
                    <div className="text-2xl font-bold font-mono text-amber-400">
                      {stats?.peakHourWeekMinutes ? formatMinutes(stats.peakHourWeekMinutes) : "—"}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    {stats?.peakHourWeekLabel ?? "No data"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Top This Week</CardTitle>
                  <Trophy className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-8 w-32" /> : (
                    <div className="text-lg font-bold font-mono text-yellow-400 truncate">
                      {(stats as any)?.topPerformersWeekly?.[0]?.callSign
                        ? `[${(stats as any).topPerformersWeekly[0].callSign}]`
                        : "—"}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 font-mono truncate">
                    {(stats as any)?.topPerformersWeekly?.[0]
                      ? `${(stats as any).topPerformersWeekly[0].name} · ${formatMinutes((stats as any).topPerformersWeekly[0].minutes)}`
                      : "No logs yet"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── BOTTOM ROWS ── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Rank Distribution */}
              <Card className="col-span-4 bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider">Rank Distribution</CardTitle>
                  <CardDescription className="font-mono">Current personnel structure</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : stats?.rankBreakdown && stats.rankBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {stats.rankBreakdown.map((item, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="w-36 font-mono text-xs truncate text-muted-foreground">{item.rank}</div>
                          <div className="flex-1 h-3 bg-muted/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/60 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, (item.count / (stats.totalMembers || 1)) * 100)}%` }}
                            />
                          </div>
                          <div className="w-8 text-right font-mono text-sm font-bold">{item.count}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">No rank data available</div>
                  )}
                </CardContent>
              </Card>

              {/* Status Overview */}
              <Card className="col-span-3 bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="uppercase tracking-wider">Status Overview</CardTitle>
                  <CardDescription className="font-mono">Deployment readiness</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {isLoading ? (
                    <>{[1,2,3,4].map(i => <Skeleton key={i} className="h-11 w-full" />)}</>
                  ) : (
                    <>
                      <StatusRow icon={<Activity className="w-4 h-4" />} color="green"
                        label="Active" count={stats?.activeMembers ?? 0}
                        sub={`${(stats as any)?.activeDutyHoursThisWeek ?? 0}h duty this week`} />
                      <StatusRow icon={<UserMinus className="w-4 h-4" />} color="amber"
                        label="Leave of Absence" count={stats?.loaMembers ?? 0}
                        sub={`${(stats as any)?.loaDutyHoursThisWeek ?? 0}h duty this week`} />
                      <StatusRow icon={<Users className="w-4 h-4" />} color="gray"
                        label="Vacant" count={stats?.vacantMembers ?? 0} />
                      <StatusRow icon={<ShieldAlert className="w-4 h-4" />} color="red"
                        label="Inactive"
                        count={stats?.totalMembers
                          ? stats.totalMembers - (stats.activeMembers ?? 0) - (stats.loaMembers ?? 0) - (stats.vacantMembers ?? 0)
                          : 0}
                        sub={`${(stats as any)?.inactiveDutyHoursThisWeek ?? 0}h duty this week`} />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

          </>
        )}
      </div>
    </Layout>
  );
}

const COLOR_MAP = {
  green: { row: "bg-green-500/10 border-green-500/20", text: "text-green-400", sub: "text-green-400/60" },
  amber: { row: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", sub: "text-amber-400/60" },
  gray:  { row: "bg-gray-500/10  border-gray-500/20",  text: "text-gray-400",  sub: "text-gray-400/60"  },
  red:   { row: "bg-red-500/10   border-red-500/20",   text: "text-red-400",   sub: "text-red-400/60"   },
};

function StatusRow({
  icon, color, label, count, sub,
}: {
  icon: React.ReactNode;
  color: keyof typeof COLOR_MAP;
  label: string;
  count: number;
  sub?: string;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn("flex items-center justify-between p-2.5 rounded-md border", c.row)}>
      <div className={cn("flex items-center gap-2.5", c.text)}>
        {icon}
        <div>
          <div className="font-medium text-sm">{label}</div>
          {sub && <div className={cn("font-mono text-xs", c.sub)}>{sub}</div>}
        </div>
      </div>
      <span className={cn("font-mono font-bold text-lg tabular-nums", c.text)}>{count}</span>
    </div>
  );
}
