import { useGetMember, getGetMemberQueryKey, useGetMemberWeeklyStats, getGetMemberWeeklyStatsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Clock, Calendar, Shield, MapPin, Clipboard, Award } from "lucide-react";
import { formatMinutes, STATUS_COLORS, SHIFT_LABELS } from "@/lib/format";

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const memberId = parseInt(id || "0", 10);

  const { data: member, isLoading: memberLoading, error: memberError } = useGetMember(memberId, {
    query: { enabled: !!memberId, queryKey: getGetMemberQueryKey(memberId) }
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useGetMemberWeeklyStats(memberId, {
    query: { enabled: !!memberId, queryKey: getGetMemberWeeklyStatsQueryKey(memberId) }
  });

  if (memberError) {
    return (
      <Layout>
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-md text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>Failed to load member details. They may have been removed.</p>
        </div>
        <Link href="/">
          <a className="mt-4 inline-flex items-center text-primary hover:underline font-mono text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Roster
          </a>
        </Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <a className="p-2 rounded hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </a>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
              {memberLoading ? <Skeleton className="h-8 w-48" /> : (
                <>
                  <span className="text-primary">{member?.callSign}</span> {member?.name}
                </>
              )}
            </h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">Personnel Dossier</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column: Personnel Info */}
          <div className="space-y-6">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Identity & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {memberLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                      <span className="text-muted-foreground font-mono text-sm">Status</span>
                      <Badge variant="outline" className={STATUS_COLORS[member?.status || ""] || ""}>
                        {member?.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                      <span className="text-muted-foreground font-mono text-sm">Rank</span>
                      <span className="font-medium">{member?.rank}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                      <span className="text-muted-foreground font-mono text-sm">Joined</span>
                      <span className="font-mono text-sm">{member?.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                      <span className="text-muted-foreground font-mono text-sm">Discord ID</span>
                      <span className="font-mono text-sm text-primary">{member?.discordId || 'Not Linked'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-mono text-sm">License</span>
                      <span className="font-mono text-xs max-w-[120px] truncate" title={member?.licenseKey || ""}>{member?.licenseKey || 'None'}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="uppercase tracking-wider text-sm text-muted-foreground flex items-center gap-2">
                  <Clipboard className="w-4 h-4" /> Command Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {memberLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <div className="bg-muted/30 p-4 rounded-md min-h-[100px] text-sm">
                    {member?.notes ? (
                      <p className="whitespace-pre-wrap">{member.notes}</p>
                    ) : (
                      <p className="text-muted-foreground italic font-mono">No operational notes on file.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Columns: Duty Statistics */}
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
                <div>
                  <CardTitle className="uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" /> Duty Time Analysis
                  </CardTitle>
                  <CardDescription className="font-mono mt-1">Rolling 5-week metrics</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-muted-foreground uppercase">Total Tracked</div>
                  {statsLoading ? <Skeleton className="h-8 w-20 ml-auto mt-1" /> : (
                    <div className="text-3xl font-bold font-mono text-primary">{formatMinutes(stats?.totalMinutes || 0)}</div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {statsError ? (
                  <div className="p-4 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20 text-center font-mono">
                    Failed to aggregate duty statistics.
                  </div>
                ) : statsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !stats?.weeks || stats.weeks.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground font-mono">
                    No duty logs recorded for this time period.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {stats.weeks.map((week, idx) => (
                      <div key={idx} className="bg-muted/10 p-4 rounded-lg border border-border/30">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-mono font-bold text-lg">{week.weekLabel}</h4>
                          <span className="font-mono text-xl text-primary">{formatMinutes(week.totalMinutes)}</span>
                        </div>
                        
                        {(() => {
                          const fullSec = week.eveningMinutes + week.nightMinutes + week.midnightMinutes;
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              <div className="bg-card p-2 rounded border border-border/50 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-mono truncate" title={SHIFT_LABELS.Evening}>{SHIFT_LABELS.Evening}</div>
                                <div className="font-mono mt-1 text-sm">{formatMinutes(week.eveningMinutes)}</div>
                              </div>
                              <div className="bg-card p-2 rounded border border-border/50 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-mono truncate" title={SHIFT_LABELS.Night}>{SHIFT_LABELS.Night}</div>
                                <div className="font-mono mt-1 text-sm">{formatMinutes(week.nightMinutes)}</div>
                              </div>
                              <div className="bg-card p-2 rounded border border-border/50 text-center">
                                <div className="text-[10px] uppercase text-muted-foreground font-mono truncate" title={SHIFT_LABELS.Midnight}>{SHIFT_LABELS.Midnight}</div>
                                <div className="font-mono mt-1 text-sm">{formatMinutes(week.midnightMinutes)}</div>
                              </div>
                              <div className="bg-card p-2 rounded border border-border/50 text-center border-primary/30">
                                <div className="text-[10px] uppercase text-primary font-mono truncate" title={SHIFT_LABELS.Full}>{SHIFT_LABELS.Full}</div>
                                <div className="font-mono mt-1 font-bold text-sm">{formatMinutes(fullSec)}</div>
                              </div>
                              <div className="bg-card p-2 rounded border border-border/50 text-center border-gray-500/30">
                                <div className="text-[10px] uppercase text-gray-400 font-mono truncate" title="Off Peak Hour">Off Peak Hr ⏾</div>
                                <div className="font-mono mt-1 text-sm text-gray-400">{formatMinutes(week.fullMinutes)}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
