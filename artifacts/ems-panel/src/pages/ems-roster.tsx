import { useState } from "react";
import { useListMembers, getListMembersQueryKey } from "@workspace/api-client-react";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { EMS_RANKS, STATUS_COLORS, RANK_COLORS, compareByRankAndCallSign } from "@/lib/format";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search, Edit, Users, CheckCircle, XCircle, Clock, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const RANK_ALIASES: Record<string, string> = {
  "Sr. Paramedic": "Senior Paramedic",
  "Sr Paramedic": "Senior Paramedic",
  "Sr. Specialist": "Senior Specialist",
  "Sr Specialist": "Senior Specialist",
  "Sgt First Class": "Sergeant First Class",
  "SFC": "Sergeant First Class",
  "Sgt": "Sergeant",
  "Lt": "Lieutenant",
  "Cpt": "Captain",
  "Asst. Director": "Assistant Director",
  "Asst Director": "Assistant Director",
  "Dep. Director": "Deputy Director",
  "Dir": "Director",
};

function normalizeRank(rank: string): string {
  return RANK_ALIASES[rank] ?? rank;
}

function MedEvacDisplay({ value }: { value: string | null | undefined }) {
  if (!value || value === "N/A") return <span className="text-muted-foreground/40 font-mono text-xs">N/A</span>;
  return (
    <span className={cn("font-mono text-xs font-medium", value === "Advance" ? "text-green-400" : "text-amber-400")}>
      {value}
    </span>
  );
}

function StrikeDisplay({ value }: { value: string | null | undefined }) {
  if (!value || value === "N/A") return <span className="text-muted-foreground/40 font-mono text-xs">N/A</span>;
  return (
    <span className={cn("font-mono text-xs font-bold", value === "3/3" ? "text-red-400" : "text-amber-400")}>
      {value}
    </span>
  );
}

function FtpDisplay({ value }: { value: string | null | undefined }) {
  if (!value || value === "N/A") return <span className="text-muted-foreground/30 font-mono text-xs">—</span>;
  const colorMap: Record<string, string> = {
    "FTP Supervisor": "text-purple-400",
    "FTP Trainer":    "text-blue-400",
    "FTP Advanced":   "text-cyan-400",
    "FTP Recruit":    "text-teal-400",
  };
  return (
    <span className={cn("font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-white/5 border border-white/10", colorMap[value] ?? "text-teal-400")}>
      {value}
    </span>
  );
}

function HcDisplay({ value }: { value: string | null | undefined }) {
  if (!value || value === "N/A" || value === "") return <span className="text-muted-foreground/30 font-mono text-xs">—</span>;
  return (
    <span className="font-mono text-xs font-semibold text-amber-400 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
      HC
    </span>
  );
}

export default function EmsRoster() {
  const { data: members, isLoading, error } = useListMembers({
    query: { queryKey: getListMembersQueryKey() }
  });
  const { data: dashboardStats } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });

  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const filteredMembers = members?.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.callSign.toLowerCase().includes(search.toLowerCase()) ||
    (m.cid && m.cid.includes(search))
  );

  const total = members?.length ?? 0;
  const active = dashboardStats?.activeMembers ?? (members?.filter(m => m.status === "Active").length ?? 0);
  const inactive = dashboardStats?.inactiveMembers ?? (members?.filter(m => m.status === "Inactive" || m.status === "Vacant").length ?? 0);
  const loa = dashboardStats?.loaMembers ?? (members?.filter(m => m.status === "LOA").length ?? 0);
  const fto = members?.filter(m => m.ftoMember && m.ftoMember !== "N/A").length ?? 0;
  const hc  = members?.filter(m => m.highCamNoted && m.highCamNoted !== "N/A" && m.highCamNoted !== "").length ?? 0;

  return (
    <Layout>
      <div className="flex flex-col gap-5">

        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight uppercase sm:text-3xl">EMS Full Roster</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">Complete member registry — editable from Admin Panel</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, CS, CID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-border/50 focus-visible:ring-primary/50 font-mono text-sm"
              />
            </div>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 sm:w-auto">
                <Edit className="w-4 h-4" />
                Edit in Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Header */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { icon: Users, label: "Total Members", value: total, color: "text-foreground" },
            { icon: CheckCircle, label: "Active", value: active, color: "text-green-400" },
            { icon: XCircle, label: "Inactive", value: inactive, color: "text-red-400" },
            { icon: Clock, label: "LOA", value: loa, color: "text-amber-400" },
            { icon: Star, label: "FTP Members", value: fto, color: "text-teal-400" },
            { icon: Star, label: "High-Command", value: hc, color: "text-amber-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="border-border/30 bg-card/50">
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                <Icon className={cn("w-5 h-5", color)} />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className={cn("text-xl font-bold font-mono", color)}>{isLoading ? "—" : value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Full Roster Table */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/50 z-10 min-w-[100px]">Call Sign</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap sticky left-[100px] bg-muted/50 z-10 min-w-[160px]">Character Name</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[110px]">Status</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[170px]">Rank</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[80px]">CID</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[110px]">Phone</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[110px]">Date Joined</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[120px]">Last Promotion</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center min-w-[80px]">MedEvac</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center min-w-[70px]">Strike</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap min-w-[150px]">High-Command</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center min-w-[80px]">FTP</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center min-w-[70px]">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/50">
                      {Array.from({ length: 13 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-32 text-center text-destructive">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 opacity-50" />
                        <p>Failed to load roster data.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* Rank sections: header immediately followed by members of that rank */}
                    {EMS_RANKS.flatMap(rankName => {
                      const rankMembers = (filteredMembers?.filter(m => normalizeRank(m.rank) === rankName) ?? [])
                        .sort(compareByRankAndCallSign);
                      if (rankMembers.length === 0) return [];

                      return [
                        <TableRow key={`rank-header-${rankName}`} className="border-border/50">
                          <TableCell colSpan={13} className="bg-muted/30 py-1.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">{rankName}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                ({rankMembers.length} member{rankMembers.length !== 1 ? "s" : ""})
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>,
                        ...rankMembers.map(member => (
                          <TableRow key={member.id} className="border-border/50 hover:bg-white/[0.02] transition-colors">
                            <TableCell className="font-mono font-bold text-primary sticky left-0 bg-background z-10 whitespace-nowrap">{member.callSign}</TableCell>
                            <TableCell className="font-medium sticky left-[100px] bg-background z-10 whitespace-nowrap">{member.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs whitespace-nowrap", STATUS_COLORS[member.status] || "")}>
                                {member.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {(() => { const r = normalizeRank(member.rank); const c = RANK_COLORS[r]; return c ? <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono border", c.bg, c.text, c.border)}>{r}</span> : <span className="text-sm text-muted-foreground">{r}</span>; })()}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{member.cid || <span className="opacity-30">—</span>}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{member.phone || <span className="opacity-30">—</span>}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{member.joinedAt || <span className="opacity-30">—</span>}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{member.lastPromotionDate || <span className="opacity-30">—</span>}</TableCell>
                            <TableCell className="text-center"><MedEvacDisplay value={member.medTrex as string} /></TableCell>
                            <TableCell className="text-center"><StrikeDisplay value={member.strike as string} /></TableCell>
                            <TableCell className="text-center"><HcDisplay value={member.highCamNoted} /></TableCell>
                            <TableCell className="text-center"><FtpDisplay value={member.ftoMember} /></TableCell>
                            <TableCell className="text-center">
                              <Link href="/admin">
                                <button className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title={`Edit ${member.name}`}>
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      ];
                    })}

                    {/* Non-standard ranks: each gets its own section header */}
                    {(() => {
                      const otherMembers = filteredMembers?.filter(m => !EMS_RANKS.includes(normalizeRank(m.rank) as any)) ?? [];
                      if (otherMembers.length === 0) return null;
                      const distinctRanks = [...new Set(otherMembers.map(m => m.rank))];
                      return distinctRanks.flatMap(rankName => {
                        const rankMembers = otherMembers
                          .filter(m => m.rank === rankName)
                          .sort(compareByRankAndCallSign);
                        return [
                          <TableRow key={`other-header-${rankName}`} className="border-border/50">
                            <TableCell colSpan={13} className="bg-muted/30 py-1.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">{rankName}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  ({rankMembers.length} member{rankMembers.length !== 1 ? "s" : ""})
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>,
                          ...rankMembers.map(member => (
                            <TableRow key={member.id} className="border-border/50 hover:bg-white/[0.02] transition-colors">
                              <TableCell className="font-mono font-bold text-primary sticky left-0 bg-background z-10 whitespace-nowrap">{member.callSign}</TableCell>
                              <TableCell className="font-medium sticky left-[100px] bg-background z-10 whitespace-nowrap">{member.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[member.status] || "")}>{member.status}</Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {(() => { const r = member.rank || ""; const c = RANK_COLORS[r]; return c ? <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono border", c.bg, c.text, c.border)}>{r}</span> : <span className="text-sm text-muted-foreground">{r}</span>; })()}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">{member.cid || <span className="opacity-30">—</span>}</TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">{member.phone || <span className="opacity-30">—</span>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{member.joinedAt || <span className="opacity-30">—</span>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{member.lastPromotionDate || <span className="opacity-30">—</span>}</TableCell>
                              <TableCell className="text-center"><MedEvacDisplay value={member.medTrex as string} /></TableCell>
                              <TableCell className="text-center"><StrikeDisplay value={member.strike as string} /></TableCell>
                              <TableCell className="text-center"><HcDisplay value={member.highCamNoted} /></TableCell>
                              <TableCell className="text-center"><FtpDisplay value={member.ftoMember} /></TableCell>
                              <TableCell className="text-center">
                                <Link href="/admin">
                                  <button className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))
                        ];
                      });
                    })()}

                    {filteredMembers?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                          No members found matching your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
