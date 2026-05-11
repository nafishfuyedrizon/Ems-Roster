import { getGetMemberQueryKey, getGetMemberWeeklyStatsQueryKey, useGetMember, useGetMemberWeeklyStats } from "@workspace/api-client-react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { PersonnelDossierView } from "@/components/personnel-dossier-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const memberId = Number.parseInt(id || "0", 10);

  const {
    data: member,
    isLoading: memberLoading,
    error: memberError,
  } = useGetMember(memberId, {
    query: { enabled: !!memberId, queryKey: getGetMemberQueryKey(memberId) },
  });

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useGetMemberWeeklyStats(memberId, {
    query: { enabled: !!memberId, queryKey: getGetMemberWeeklyStatsQueryKey(memberId) },
  });

  if (memberError) {
    return (
      <Layout>
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-destructive shadow-[0_20px_45px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <AlertCircle className="h-5 w-5" />
            Failed to load officer profile
          </div>
          <p className="mt-2 text-sm text-destructive/90">This personnel dossier may have been removed or is currently unavailable.</p>
        </div>
        <Link href="/">
          <Button className="mt-5" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Return to Roster
          </Button>
        </Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 shadow-[0_12px_28px_rgba(0,229,255,0.08)]">
              <span className="text-xs font-mono uppercase tracking-[0.28em] text-primary">EMS Profile Card</span>
            </div>
            {memberLoading ? (
              <Skeleton className="h-10 w-64 rounded-2xl" />
            ) : (
              <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground sm:text-4xl">
                {member?.name || "Officer"} Dossier
              </h1>
            )}
            <p className="text-sm font-mono uppercase tracking-[0.22em] text-muted-foreground">
              Command-ready EMS profile view with weekly duty intelligence
            </p>
          </div>

          <Link href="/">
            <Button
              variant="outline"
              className="rounded-2xl border-primary/20 bg-primary/10 px-5 py-6 text-sm font-semibold uppercase tracking-[0.18em] text-primary shadow-[0_12px_28px_rgba(0,229,255,0.08)] hover:bg-primary/15"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Roster
            </Button>
          </Link>
        </div>

        <PersonnelDossierView
          member={member}
          stats={stats}
          memberLoading={memberLoading}
          statsLoading={statsLoading}
          statsError={!!statsError}
          heroAction={
            <Link href="/">
              <Button className="rounded-2xl bg-primary px-5 py-6 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-[0_18px_36px_rgba(0,229,255,0.16)] hover:bg-primary/90">
                Return to Roster
              </Button>
            </Link>
          }
        />
      </div>
    </Layout>
  );
}
