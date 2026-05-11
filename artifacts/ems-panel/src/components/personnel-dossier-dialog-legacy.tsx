import { getGetMemberQueryKey, getGetMemberWeeklyStatsQueryKey, useGetMember, useGetMemberWeeklyStats } from "@workspace/api-client-react";
import { AlertCircle, Award, Clipboard, Clock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMinutes, RANK_COLORS, SHIFT_LABELS, STATUS_COLORS } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PersonnelDossierDialogLegacyProps {
  memberId: number | null;
  onClose: () => void;
}

export function PersonnelDossierDialogLegacy({ memberId, onClose }: PersonnelDossierDialogLegacyProps) {
  const open = memberId !== null;

  const { data: member, isLoading: memberLoading } = useGetMember(memberId ?? 0, {
    query: { enabled: !!memberId, queryKey: getGetMemberQueryKey(memberId ?? 0) },
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useGetMemberWeeklyStats(memberId ?? 0, {
    query: { enabled: !!memberId, queryKey: getGetMemberWeeklyStatsQueryKey(memberId ?? 0) },
  });

  const rankStyle = member?.rank ? RANK_COLORS[member.rank] : null;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto border-border/50 bg-card p-0">
        <div className="sticky top-0 z-10 border-b border-border/50 bg-card px-6 pb-4 pt-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold uppercase tracking-tight">
              {memberLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <>
                  <span className="font-mono text-primary">{member?.callSign}</span>
                  <span>{member?.name}</span>
                </>
              )}
            </DialogTitle>
            <p className="mt-0.5 text-xs font-mono uppercase tracking-widest text-muted-foreground">Personnel Dossier</p>
          </DialogHeader>
        </div>

        <div className="grid gap-5 px-6 pb-6 pt-4 md:grid-cols-3">
          <div className="space-y-4">
            <Card className="border-border/40 bg-background/50">
              <CardHeader className="px-4 pb-2 pt-3">
                <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" /> Identity & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                {memberLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <>
                    <LegacyRow label="Status">
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[member?.status || ""] || "")}>
                        {member?.status}
                      </Badge>
                    </LegacyRow>
                    <LegacyRow label="Rank">
                      {rankStyle ? (
                        <span className={cn("rounded border px-1.5 py-0.5 font-mono text-xs font-semibold", rankStyle.bg, rankStyle.text, rankStyle.border)}>
                          {member?.rank}
                        </span>
                      ) : (
                        <span className="font-mono text-sm">{member?.rank}</span>
                      )}
                    </LegacyRow>
                    <LegacyRow label="Joined">
                      <span className="font-mono text-xs">{member?.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "—"}</span>
                    </LegacyRow>
                    <LegacyRow label="CID">
                      <span className="font-mono text-xs text-primary">{member?.cid || "—"}</span>
                    </LegacyRow>
                    {member?.ftoMember && member.ftoMember !== "N/A" ? (
                      <LegacyRow label="FTP Rank">
                        <span className="font-mono text-xs text-teal-400">{member.ftoMember as string}</span>
                      </LegacyRow>
                    ) : null}
                    {member?.highCamNoted && member.highCamNoted !== "N/A" && member.highCamNoted !== "" ? (
                      <LegacyRow label="HC Status">
                        <span className="font-mono text-xs font-semibold text-amber-400">HC</span>
                      </LegacyRow>
                    ) : null}
                    {member?.medTrex && member.medTrex !== "N/A" ? (
                      <LegacyRow label="MedEvac">
                        <span className={cn("font-mono text-xs", member.medTrex === "Advance" ? "text-green-400" : "text-amber-400")}>
                          {member.medTrex as string}
                        </span>
                      </LegacyRow>
                    ) : null}
                    {member?.strike && member.strike !== "N/A" ? (
                      <LegacyRow label="Strike">
                        <span className={cn("font-mono text-xs font-bold", member.strike === "3/3" ? "text-red-400" : "text-amber-400")}>
                          {member.strike as string}
                        </span>
                      </LegacyRow>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-background/50">
              <CardHeader className="px-4 pb-2 pt-3">
                <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Clipboard className="h-3.5 w-3.5" /> Command Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {memberLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="min-h-[60px] rounded bg-muted/20 p-3 text-sm">
                    {member?.notes ? (
                      <p className="whitespace-pre-wrap text-sm">{member.notes}</p>
                    ) : (
                      <p className="font-mono text-xs italic text-muted-foreground">No notes on file.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card className="border-border/40 bg-background/50">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-4 pb-3 pt-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm uppercase tracking-widest">Duty Time Analysis</CardTitle>
                </div>
                {statsLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <span className="font-mono text-xl font-bold text-primary">{formatMinutes(stats?.totalMinutes || 0)}</span>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-4">
                {statsError ? (
                  <div className="flex h-24 items-center justify-center gap-2 font-mono text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Failed to aggregate duty statistics.
                  </div>
                ) : statsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !stats?.weeks || stats.weeks.length === 0 ? (
                  <div className="flex h-24 items-center justify-center gap-2 font-mono text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    No duty logs recorded.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.weeks.map((week: any, idx: number) => {
                      const fullMinutes = week.eveningMinutes + week.nightMinutes + week.midnightMinutes;
                      return (
                        <div key={idx} className="rounded border border-border/30 bg-muted/10 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-mono text-sm font-semibold">{week.weekLabel}</span>
                            <span className="font-mono font-bold text-primary">{formatMinutes(week.totalMinutes)}</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[
                              { label: SHIFT_LABELS.Evening, mins: week.eveningMinutes, accent: "text-indigo-400" },
                              { label: SHIFT_LABELS.Night, mins: week.nightMinutes, accent: "text-violet-400" },
                              { label: SHIFT_LABELS.Midnight, mins: week.midnightMinutes, accent: "text-blue-400" },
                              { label: SHIFT_LABELS.Full, mins: fullMinutes, accent: "text-orange-400" },
                              { label: "Off Peak Hr ⏾", mins: week.fullMinutes, accent: "text-gray-400" },
                            ].map(({ label, mins, accent }) => (
                              <div key={label} className="rounded border border-border/40 bg-card p-1.5 text-center">
                                <div className={cn("truncate text-[9px] font-mono uppercase", accent)} title={label}>{label}</div>
                                <div className="mt-0.5 font-mono text-xs">{formatMinutes(mins)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LegacyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
