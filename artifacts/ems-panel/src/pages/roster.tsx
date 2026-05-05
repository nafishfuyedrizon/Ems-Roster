import { useGetRosterWithWeeklyDuty, getGetRosterWithWeeklyDutyQueryKey } from "@workspace/api-client-react";
import { formatMinutes, WEEKS, STATUS_COLORS, MIN_WEEKLY_MINUTES, RED_WEEKS_THRESHOLD, isWeekEligible, isCompletedWeek } from "@/lib/format";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PersonnelDossierDialog } from "@/components/personnel-dossier-dialog";

const REFRESH_INTERVAL = 1;

export default function Roster() {
  const { data: roster, isLoading, error } = useGetRosterWithWeeklyDuty({
    query: {
      queryKey: getGetRosterWithWeeklyDutyQueryKey(),
      refetchInterval: REFRESH_INTERVAL * 1000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 0,
    }
  });

  const [search, setSearch] = useState("");
  const [dossierMemberId, setDossierMemberId] = useState<number | null>(null);

  const filteredRoster = roster?.filter(entry =>
    entry.name.toLowerCase().includes(search.toLowerCase()) ||
    entry.callSign.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight uppercase sm:text-3xl">Public Roster</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">Official Member Duty Records</p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by CS or Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40 inline-block" />
            Completed week &lt; 5h (warning)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500/10 border border-red-500/20 inline-block" />
            3 consecutive red weeks → auto Inactive
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground/50">
            — = pre-join week (excluded)
          </span>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-[100px] font-mono text-xs uppercase tracking-wider text-muted-foreground">CS</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Name</TableHead>
                  <TableHead className="w-[120px] font-mono text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Rank</TableHead>
                  {WEEKS.map(w => (
                    <TableHead key={w.weekStart} className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">{w.label}</TableHead>
                  ))}
                  <TableHead className="text-right font-mono text-xs uppercase tracking-wider text-primary">Monthly Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/50">
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      {WEEKS.map(w => <TableCell key={w.weekStart} className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>)}
                      <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-destructive">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 opacity-50" />
                        <p>Failed to load roster data.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRoster?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No members found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoster?.map((entry) => {
                    const weekData = WEEKS.map(week => {
                      const eligible = isWeekEligible(week.weekStart, entry.joinedAt);
                      const complete = isCompletedWeek(week.weekStart);
                      if (!eligible) return { eligible: false, complete, mins: null };
                      const weekLog = entry.weeks?.find(w => w.weekStart === week.weekStart);
                      return { eligible: true, complete, mins: weekLog?.totalMinutes ?? 0 };
                    });
                    const isActive = entry.status === "Active";
                    const eligibleMins = weekData.filter(w => w.eligible && w.complete).map(w => w.mins as number);
                    const recentMins = eligibleMins.slice(0, RED_WEEKS_THRESHOLD);
                    const recentRedCount = isActive ? recentMins.filter(m => m < MIN_WEEKLY_MINUTES).length : 0;
                    const hoursInactive = isActive && recentMins.length >= RED_WEEKS_THRESHOLD && recentRedCount >= RED_WEEKS_THRESHOLD;
                    const inactive = entry.status === "Inactive" || hoursInactive;
                    const monthRed = hoursInactive;
                    const displayStatus = hoursInactive ? "Inactive" : entry.status;

                    return (
                      <TableRow
                        key={entry.id}
                        className="border-border/50 transition-colors group hover:bg-white/[0.02]"
                      >
                        <TableCell className={cn("font-mono font-medium", inactive ? "text-muted-foreground" : "text-primary")}>
                          {entry.callSign}
                        </TableCell>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => setDossierMemberId(entry.id)}
                            className="hover:text-primary hover:underline transition-colors text-left"
                          >
                            {entry.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[displayStatus] || ""}>
                            {displayStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{entry.rank}</TableCell>
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
                                isRed ? "text-red-400 bg-red-500/5" : "text-muted-foreground"
                              )}
                            >
                              {formatMinutes(mins)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right">
                          <span className={cn("font-mono font-bold", monthRed ? "text-red-400" : "text-primary")}>
                            {formatMinutes(entry.totalMonthMinutes)}
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
      </div>

      <PersonnelDossierDialog
        memberId={dossierMemberId}
        onClose={() => setDossierMemberId(null)}
      />
    </Layout>
  );
}
