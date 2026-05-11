import type { ReactNode } from "react";
import {
  AlertCircle,
  Award,
  Calendar,
  Clipboard,
  Clock3,
  Fingerprint,
  MapPin,
  Phone,
  Shield,
  Siren,
  TimerReset,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMinutes, RANK_COLORS, SHIFT_LABELS, STATUS_COLORS } from "@/lib/format";
import { cn } from "@/lib/utils";

type MemberLike = {
  callSign?: string | null;
  name?: string | null;
  status?: string | null;
  rank?: string | null;
  joinedAt?: string | null;
  discordId?: string | null;
  licenseKey?: string | null;
  notes?: string | null;
  cid?: string | number | null;
  phone?: string | null;
  phoneNumber?: string | null;
  timezone?: string | null;
  strike?: string | null;
  medTrex?: string | null;
  ftoMember?: string | null;
  highCamNoted?: string | null;
};

type WeekLike = {
  weekLabel: string;
  totalMinutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  midnightMinutes: number;
  fullMinutes: number;
};

type StatsLike = {
  totalMinutes?: number;
  weeks?: WeekLike[];
};

type PersonnelDossierViewProps = {
  member?: MemberLike | null;
  stats?: StatsLike | null;
  memberLoading?: boolean;
  statsLoading?: boolean;
  statsError?: boolean;
  heroAction?: ReactNode;
  compact?: boolean;
};

const SHIFT_ROWS = [
  { key: "eveningMinutes", label: "Normal", accent: "from-sky-500/90 to-cyan-400/90", glow: "shadow-sky-500/20", border: "border-sky-400/30" },
  { key: "nightMinutes", label: "Training", accent: "from-orange-500/90 to-amber-400/90", glow: "shadow-orange-500/20", border: "border-orange-400/30" },
  { key: "midnightMinutes", label: "Undercover", accent: "from-fuchsia-500/90 to-violet-400/90", glow: "shadow-fuchsia-500/20", border: "border-fuchsia-400/30" },
  { key: "totalMinutes", label: "Extra", accent: "from-yellow-500/90 to-amber-300/90", glow: "shadow-yellow-500/20", border: "border-yellow-400/30" },
  { key: "fullMinutes", label: "Total", accent: "from-rose-500/90 to-red-400/90", glow: "shadow-rose-500/20", border: "border-rose-400/30" },
] as const;

export function PersonnelDossierView({
  member,
  stats,
  memberLoading = false,
  statsLoading = false,
  statsError = false,
  heroAction,
  compact = false,
}: PersonnelDossierViewProps) {
  const rankStyle = member?.rank ? RANK_COLORS[member.rank] : null;
  const weeks = stats?.weeks ?? [];
  const hasTrackedDuty = weeks.some((week) => week.totalMinutes > 0 || week.fullMinutes > 0 || week.eveningMinutes > 0 || week.nightMinutes > 0 || week.midnightMinutes > 0);
  const shellGap = compact ? "gap-4" : "gap-6";
  const sidePad = compact ? "px-4 pb-4 pt-4" : "px-5 pb-5 pt-5";

  return (
    <div className={cn("grid xl:grid-cols-[300px_minmax(0,1fr)]", shellGap)}>
      <div className={cn("space-y-4", compact && "xl:max-w-[280px]")}>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-card to-card/80 shadow-[0_0_0_1px_rgba(0,229,255,0.04),0_20px_45px_rgba(0,0,0,0.22)]">
          <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/10 via-cyan-400/5 to-transparent pb-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" /> Details
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("space-y-2.5", sidePad)}>
            {memberLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <ProfileStat icon={<Award className="h-4 w-4" />} label="Rank" value={member?.rank || "Unassigned"} />
                <ProfileStat icon={<Fingerprint className="h-4 w-4" />} label="CID" value={member?.cid || "Unknown"} />
                <ProfileStat icon={<Calendar className="h-4 w-4" />} label="Joined" value={member?.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "Unknown"} />
                <ProfileStat icon={<TimerReset className="h-4 w-4" />} label="Status" value={member?.status || "Unknown"} statusClass={STATUS_COLORS[member?.status || ""]} />
                <ProfileStat icon={<Phone className="h-4 w-4" />} label="Phone" value={member?.phone || member?.phoneNumber || "No phone"} />
                <ProfileStat icon={<MapPin className="h-4 w-4" />} label="Zone" value={member?.timezone || "ASIA"} />
                <ProfileStat icon={<Siren className="h-4 w-4" />} label="Strikes" value={normalizeStrike(member?.strike)} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 bg-card/90 shadow-[0_16px_38px_rgba(0,0,0,0.18)]">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-muted-foreground">
              <Clipboard className="h-4 w-4 text-primary" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(sidePad, "min-h-[132px]")}>
            {memberLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : member?.notes ? (
              <div className="rounded-2xl border border-primary/10 bg-background/40 p-4 text-sm leading-6 text-foreground/90 shadow-inner shadow-black/10 whitespace-pre-wrap">
                {member.notes}
              </div>
            ) : (
              <div className="flex min-h-[92px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/30 px-4 text-center text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                No command notes on file
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 bg-card/90 shadow-[0_16px_38px_rgba(0,0,0,0.18)]">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-muted-foreground">
              <Award className="h-4 w-4 text-primary" /> Certifications
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(sidePad, "space-y-2.5")}>
            {memberLoading ? (
              <>
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </>
            ) : (
              <>
                <CertificationChip label="FTP" value={member?.ftoMember && member.ftoMember !== "N/A" ? String(member.ftoMember) : "Not Assigned"} />
                <CertificationChip label="HC / FTB" value={member?.highCamNoted && member.highCamNoted !== "N/A" ? "High Command Flagged" : "Clear"} />
                <CertificationChip label="MedEvac" value={member?.medTrex && member.medTrex !== "N/A" ? String(member.medTrex) : "Standard"} />
                <CertificationChip label="Discord" value={member?.discordId ? "Linked" : "Not Linked"} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-cyan-950/20 shadow-[0_0_0_1px_rgba(0,229,255,0.04),0_28px_60px_rgba(0,0,0,0.28)]">
          <CardContent className={cn("space-y-4", compact ? "p-4" : "p-5")}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {memberLoading ? (
                    <Skeleton className="h-10 w-64 rounded-xl" />
                  ) : (
                    <>
                      <h2 className={cn("font-bold uppercase tracking-tight", compact ? "text-2xl" : "text-3xl")}>
                        <span className="text-primary font-mono">[{member?.callSign || "N/A"}]</span>{" "}
                        {member?.name || "Unknown Officer"}
                      </h2>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-lg border px-3 py-1 text-sm font-semibold uppercase tracking-[0.18em]",
                          STATUS_COLORS[member?.status || ""] || "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
                        )}
                      >
                        {member?.status || "Unknown"}
                      </Badge>
                    </>
                  )}
                </div>
                <p className="text-xs font-mono uppercase tracking-[0.32em] text-muted-foreground">
                  EMS personnel dossier // active command profile
                </p>
                <div className="flex flex-wrap gap-2">
                  {memberLoading ? (
                    <>
                      <Skeleton className="h-8 w-24 rounded-full" />
                      <Skeleton className="h-8 w-24 rounded-full" />
                      <Skeleton className="h-8 w-24 rounded-full" />
                    </>
                  ) : (
                    <>
                      <HeroChip icon={<UserRound className="h-3.5 w-3.5" />} label="CID" value={member?.cid || "Unknown"} />
                      <HeroChip icon={<Shield className="h-3.5 w-3.5" />} label="Call Sign" value={member?.callSign || "N/A"} />
                      <HeroChip icon={<Fingerprint className="h-3.5 w-3.5" />} label="License" value={member?.licenseKey || "Not Linked"} />
                    </>
                  )}
                </div>
              </div>
              {heroAction ? <div className="shrink-0">{heroAction}</div> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <HeroMetric label="Total Tracked" value={statsLoading ? "..." : hasTrackedDuty ? formatMinutes(stats?.totalMinutes || 0) : "No Logs"} accent="text-cyan-300" />
              <HeroMetric label="Rank" value={memberLoading ? "..." : member?.rank || "Unknown"} accent={rankStyle?.text || "text-emerald-300"} />
              <HeroMetric label="Service State" value={memberLoading ? "..." : member?.status || "Unknown"} accent="text-lime-300" />
              <HeroMetric label="Notes" value={memberLoading ? "..." : member?.notes ? "Filed" : "Clear"} accent="text-amber-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 bg-card/90 shadow-[0_16px_38px_rgba(0,0,0,0.18)]">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-muted-foreground">
                  <Clock3 className="h-4 w-4 text-primary" /> Duty Matrix
                </CardTitle>
                <p className="mt-1 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground/80">
                  Current cycle to last four full weeks
                </p>
              </div>
              {!statsLoading && !statsError ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-right shadow-[0_10px_30px_rgba(0,229,255,0.08)]">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary/80">Tracked Hours</div>
                  <div className="text-lg font-bold text-primary">{hasTrackedDuty ? formatMinutes(stats?.totalMinutes || 0) : "SYNC PENDING"}</div>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className={cn("overflow-x-auto", compact ? "p-4" : "p-5")}>
            {statsError ? (
              <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-3xl border border-destructive/30 bg-destructive/10 px-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Failed to aggregate duty statistics.
              </div>
            ) : statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : weeks.length === 0 || !hasTrackedDuty ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-border/60 bg-background/30 px-4 text-center text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground">
                No duty logs synced yet for this officer
              </div>
            ) : (
              <div className="min-w-[860px] space-y-3">
                <div className="grid grid-cols-[120px_repeat(5,minmax(0,1fr))] gap-3">
                  <div />
                  {weeks.slice(0, 5).map((week, index) => (
                    <div
                      key={`${week.weekLabel}-${index}`}
                      className="rounded-2xl border border-primary/10 bg-gradient-to-b from-background/80 to-background/30 px-4 py-3 text-center shadow-[0_12px_30px_rgba(0,0,0,0.14)]"
                    >
                      <div className="text-lg font-bold leading-none text-foreground">{columnLabel(index)}</div>
                      <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{week.weekLabel}</div>
                    </div>
                  ))}
                </div>
                {SHIFT_ROWS.map((row) => (
                  <div key={row.key} className="grid grid-cols-[120px_repeat(5,minmax(0,1fr))] gap-3">
                    <div className="flex items-center rounded-2xl border border-border/40 bg-background/40 px-4 text-sm font-bold uppercase tracking-[0.14em] text-foreground">
                      {row.label}
                    </div>
                    {weeks.slice(0, 5).map((week, index) => {
                      const value = resolveWeekValue(week, row.key);
                      return (
                        <div
                          key={`${row.key}-${week.weekLabel}-${index}`}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-center text-white shadow-[0_10px_22px_rgba(0,0,0,0.18)]",
                            row.border,
                            row.glow,
                            `bg-gradient-to-r ${row.accent}`,
                          )}
                        >
                          <div className="text-sm font-bold leading-none">{formatMinutes(value)}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function normalizeStrike(strike: string | null | undefined) {
  if (!strike || strike === "N/A") return "0 Strikes";
  return strike.includes("Strike") ? strike : `${strike} Strikes`;
}

function resolveWeekValue(week: WeekLike, key: (typeof SHIFT_ROWS)[number]["key"]) {
  if (key === "fullMinutes") return week.fullMinutes;
  if (key === "totalMinutes") return week.totalMinutes;
  return week[key];
}

function columnLabel(index: number) {
  if (index === 0) return "Current";
  if (index === 1) return "Last";
  return `${index + 1} Weeks`;
}

function HeroChip({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/50 px-3 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
      <span className="text-primary">{icon}</span>
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function HeroMetric({ label, value, accent }: { label: string; value: ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/35 px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-lg font-bold", accent)}>{value}</div>
    </div>
  );
}

function ProfileStat({
  icon,
  label,
  value,
  statusClass,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  statusClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/45 px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.14)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
        <div className={cn("mt-1 truncate text-sm font-semibold text-foreground", statusClass && "inline-flex rounded-md border px-2 py-0.5 text-xs uppercase tracking-[0.18em]", statusClass)}>
          {value}
        </div>
      </div>
    </div>
  );
}

function CertificationChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/45 px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.14)]">
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
