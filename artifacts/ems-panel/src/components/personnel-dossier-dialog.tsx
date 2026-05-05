import { useGetMember, getGetMemberQueryKey, useGetMemberWeeklyStats, getGetMemberWeeklyStatsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Shield, Clipboard, Award, AlertCircle } from "lucide-react";
import { formatMinutes, STATUS_COLORS, SHIFT_LABELS, RANK_COLORS } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PersonnelDossierDialogProps {
  memberId: number | null;
  onClose: () => void;
}

export function PersonnelDossierDialog({ memberId, onClose }: PersonnelDossierDialogProps) {
  const open = memberId !== null;

  const { data: member, isLoading: memberLoading } = useGetMember(memberId ?? 0, {
    query: { enabled: !!memberId, queryKey: getGetMemberQueryKey(memberId ?? 0) }
  });

  const { data: stats, isLoading: statsLoading } = useGetMemberWeeklyStats(memberId ?? 0, {
    query: { enabled: !!memberId, queryKey: getGetMemberWeeklyStatsQueryKey(memberId ?? 0) }
  });

  const rankStyle = member?.rank ? RANK_COLORS[member.rank] : null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-6xl bg-card border-border/50 max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border/50 px-6 pt-5 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold uppercase tracking-tight">
              {memberLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <>
                  <span className="text-primary font-mono">{member?.callSign}</span>
                  <span>{member?.name}</span>
                </>
              )}
            </DialogTitle>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-0.5">Personnel Dossier</p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-4 grid gap-5 md:grid-cols-3">
          {/* Left: Identity + Notes */}
          <div className="space-y-4">
            <Card className="bg-background/50 border-border/40">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Identity & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {memberLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <>
                    <Row label="Status">
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[member?.status || ""] || "")}>
                        {member?.status}
                      </Badge>
                    </Row>
                    <Row label="Rank">
                      {rankStyle ? (
                        <span className={cn("text-xs font-semibold font-mono px-1.5 py-0.5 rounded border", rankStyle.bg, rankStyle.text, rankStyle.border)}>
                          {member?.rank}
                        </span>
                      ) : (
                        <span className="font-mono text-sm">{member?.rank}</span>
                      )}
                    </Row>
                    <Row label="Joined">
                      <span className="font-mono text-xs">{member?.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "—"}</span>
                    </Row>
                    <Row label="CID">
                      <span className="font-mono text-xs text-primary">{member?.cid || "—"}</span>
                    </Row>
                    {member?.ftoMember && member.ftoMember !== "N/A" && (
                      <Row label="FTP Rank">
                        <span className="font-mono text-xs text-teal-400">{member.ftoMember as string}</span>
                      </Row>
                    )}
                    {member?.highCamNoted && member.highCamNoted !== "N/A" && member.highCamNoted !== "" && (
                      <Row label="HC Status">
                        <span className="font-mono text-xs font-semibold text-amber-400">HC</span>
                      </Row>
                    )}
                    {member?.medTrex && member.medTrex !== "N/A" && (
                      <Row label="MedEvac">
                        <span className={cn("font-mono text-xs", member.medTrex === "Advance" ? "text-green-400" : "text-amber-400")}>
                          {member.medTrex as string}
                        </span>
                      </Row>
                    )}
                    {member?.strike && member.strike !== "N/A" && (
                      <Row label="Strike">
                        <span className={cn("font-mono text-xs font-bold", member.strike === "3/3" ? "text-red-400" : "text-amber-400")}>
                          {member.strike as string}
                        </span>
                      </Row>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-background/50 border-border/40">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clipboard className="w-3.5 h-3.5" /> Command Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {memberLoading ? <Skeleton className="h-16 w-full" /> : (
                  <div className="bg-muted/20 rounded p-3 min-h-[60px] text-sm">
                    {member?.notes
                      ? <p className="whitespace-pre-wrap text-sm">{member.notes}</p>
                      : <p className="text-muted-foreground italic font-mono text-xs">No notes on file.</p>
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Duty Time Analysis */}
          <div className="md:col-span-2">
            <Card className="bg-background/50 border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 px-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm uppercase tracking-widest">Duty Time Analysis</CardTitle>
                </div>
                {statsLoading ? <Skeleton className="h-7 w-20" /> : (
                  <span className="font-mono font-bold text-primary text-xl">{formatMinutes(stats?.totalMinutes || 0)}</span>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-4">
                {statsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !stats?.weeks || stats.weeks.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 h-24 text-muted-foreground font-mono text-sm">
                    <AlertCircle className="w-4 h-4" />
                    No duty logs recorded.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.weeks.map((week: any, idx: number) => (
                      <div key={idx} className="bg-muted/10 p-3 rounded border border-border/30">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-mono font-semibold text-sm">{week.weekLabel}</span>
                          <span className="font-mono text-primary font-bold">{formatMinutes(week.totalMinutes)}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {(() => {
                            const fullSec = week.eveningMinutes + week.nightMinutes + week.midnightMinutes;
                            return [
                              { label: SHIFT_LABELS.Evening, mins: week.eveningMinutes, accent: "text-indigo-400" },
                              { label: SHIFT_LABELS.Night,   mins: week.nightMinutes,   accent: "text-violet-400" },
                              { label: SHIFT_LABELS.Midnight,mins: week.midnightMinutes,accent: "text-blue-400"   },
                              { label: SHIFT_LABELS.Full,    mins: fullSec,             accent: "text-orange-400" },
                              { label: "Off Peak Hr ⏾",     mins: week.fullMinutes,    accent: "text-gray-400"   },
                            ];
                          })().map(({ label, mins, accent }) => (
                            <div key={label} className="bg-card rounded border border-border/40 p-1.5 text-center">
                              <div className={cn("text-[9px] uppercase font-mono truncate", accent)} title={label}>{label}</div>
                              <div className="font-mono text-xs mt-0.5">{formatMinutes(mins)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center pb-2 border-b border-border/30 last:border-0 last:pb-0">
      <span className="text-muted-foreground font-mono text-xs uppercase tracking-wide">{label}</span>
      <span>{children}</span>
    </div>
  );
}
