import { getGetMemberQueryKey, getGetMemberWeeklyStatsQueryKey, useGetMember, useGetMemberWeeklyStats } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonnelDossierView } from "@/components/personnel-dossier-view";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonnelDossierDialogProps {
  memberId: number | null;
  onClose: () => void;
}

export function PersonnelDossierDialog({ memberId, onClose }: PersonnelDossierDialogProps) {
  const open = memberId !== null;

  const { data: member, isLoading: memberLoading } = useGetMember(memberId ?? 0, {
    query: { enabled: !!memberId, queryKey: getGetMemberQueryKey(memberId ?? 0) },
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useGetMemberWeeklyStats(memberId ?? 0, {
    query: { enabled: !!memberId, queryKey: getGetMemberWeeklyStatsQueryKey(memberId ?? 0) },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-[1400px] overflow-y-auto border-primary/20 bg-gradient-to-b from-card to-card/95 p-0 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <div className="sticky top-0 z-10 border-b border-border/40 bg-card/95 px-6 py-5 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-3 text-left text-2xl font-bold uppercase tracking-tight">
              {memberLoading ? (
                <Skeleton className="h-8 w-56 rounded-xl" />
              ) : (
                <>
                  <span className="text-primary font-mono">[{member?.callSign || "N/A"}]</span>
                  <span>{member?.name || "Officer Dossier"}</span>
                </>
              )}
            </DialogTitle>
            <p className="mt-1 text-xs font-mono uppercase tracking-[0.28em] text-muted-foreground">
              EMS command profile // dossier preview
            </p>
          </DialogHeader>
        </div>

        <div className="p-6">
          <PersonnelDossierView
            member={member}
            stats={stats}
            memberLoading={memberLoading}
            statsLoading={statsLoading}
            statsError={!!statsError}
            compact
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
