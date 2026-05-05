import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, Shield, Lock, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMS_RANKS } from "@/lib/format";
import type { AdminRole } from "@/hooks/use-auth";
import { API_BASE as API } from "@/lib/api-base";

interface StaffRoleRow {
  memberId: number;
  callSign: string;
  name: string;
  rank: string;
  status: string;
  isSuperAdmin: boolean;
  isSeniorStaff: boolean;
  isStaff: boolean;
  isFTB: boolean;
  hasQCAccess: boolean;
}

const ROLE_KEYS: { key: keyof StaffRoleRow; label: string; color: string }[] = [
  { key: "isSuperAdmin", label: "Full Power", color: "text-red-400" },
  { key: "isSeniorStaff", label: "High Command", color: "text-orange-400" },
  { key: "isStaff", label: "FTP EMS", color: "text-yellow-400" },
  { key: "isFTB", label: "FTB", color: "text-blue-400" },
];

const HIGH_COMMAND_LOCKED: (keyof StaffRoleRow)[] = ["isSuperAdmin", "isSeniorStaff"];

export default function AdminStaffRoles({ adminRole }: { adminRole?: AdminRole }) {
  const isHighCommand = adminRole === "high-command";
  const [rows, setRows] = useState<StaffRoleRow[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/staff-roles`);
      const data = await res.json();
      setRows(data);
    } catch {
      toast({ title: "Error", description: "Failed to load staff roles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleToggle = async (memberId: number, key: keyof StaffRoleRow, current: boolean) => {
    const updated = rows.map((r) =>
      r.memberId === memberId ? { ...r, [key]: !current } : r
    );
    setRows(updated);
    setSaving(memberId);

    const row = updated.find((r) => r.memberId === memberId)!;
    try {
      const res = await fetch(`${API}/staff-roles/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isSuperAdmin: row.isSuperAdmin,
          isSeniorStaff: row.isSeniorStaff,
          isStaff: row.isStaff,
          isFTB: row.isFTB,
          hasQCAccess: row.hasQCAccess,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Saved", description: "Role updated successfully" });
    } catch {
      setRows(rows);
      toast({ title: "Error", description: "Failed to save role", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const filtered = rows
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        r.callSign.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.rank.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const ai = EMS_RANKS.indexOf(a.rank);
      const bi = EMS_RANKS.indexOf(b.rank);
      const rankA = ai === -1 ? 999 : ai;
      const rankB = bi === -1 ? 999 : bi;
      if (rankA !== rankB) return rankA - rankB;
      return a.callSign.localeCompare(b.callSign);
    });

  const hasAnyRole = (r: StaffRoleRow) =>
    r.isSuperAdmin || r.isSeniorStaff || r.isStaff || r.isFTB || r.hasQCAccess;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search by name or call sign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 bg-background/50 border-border/50 text-xs"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={fetchRoles} className="h-8 text-xs gap-1.5">
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border border-border/50 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="text-left px-4 py-3 font-mono uppercase tracking-wider text-muted-foreground w-40">
                Call Sign
              </th>
              <th className="text-left px-4 py-3 font-mono uppercase tracking-wider text-muted-foreground">
                Name / Rank
              </th>
              {ROLE_KEYS.map(({ key, label, color }) => (
                <th key={key} className={cn("text-center px-3 py-3 font-mono uppercase tracking-wider", color)}>
                  {label}
                </th>
              ))}
              {/* QC Access — separated visually */}
              <th className="text-center px-3 py-3 font-mono uppercase tracking-wider text-cyan-400 border-l border-border/50">
                <span className="flex items-center justify-center gap-1">
                  <ClipboardList className="w-3 h-3" />
                  QC Access
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground font-mono text-xs">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground font-mono text-xs">
                  No members found
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr
                  key={row.memberId}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    i % 2 === 0 ? "bg-background/20" : "bg-muted/5",
                    "hover:bg-primary/5",
                    saving === row.memberId && "opacity-60"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {hasAnyRole(row) && <Shield className="w-3 h-3 text-primary shrink-0" />}
                      <span className="font-mono font-semibold text-primary">{row.callSign}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground font-medium">{row.name}</span>
                      <span className="text-muted-foreground text-[11px]">{row.rank}</span>
                    </div>
                  </td>
                  {ROLE_KEYS.map(({ key }) => {
                    const isLocked = isHighCommand && HIGH_COMMAND_LOCKED.includes(key);
                    return (
                      <td key={key} className="px-3 py-3 text-center">
                        <div className="flex justify-center items-center">
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                          ) : (
                            <Switch
                              checked={row[key] as boolean}
                              onCheckedChange={() => handleToggle(row.memberId, key, row[key] as boolean)}
                              disabled={saving === row.memberId}
                              className="data-[state=checked]:bg-primary scale-90"
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {/* QC Access column — separated */}
                  <td className="px-3 py-3 text-center border-l border-border/50">
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={row.hasQCAccess}
                        onCheckedChange={() => handleToggle(row.memberId, "hasQCAccess", row.hasQCAccess)}
                        disabled={saving === row.memberId}
                        className="data-[state=checked]:bg-cyan-500 scale-90"
                      />
                      {row.hasQCAccess && !row.isFTB && (
                        <span className="text-[9px] text-orange-400/70 font-mono">FTB missing</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono">
        <span>{filtered.length} member{filtered.length !== 1 ? "s" : ""} shown</span>
        <span>·</span>
        <span>{rows.filter(hasAnyRole).length} with active roles</span>
        <span>·</span>
        <span className="text-cyan-400/70">
          {rows.filter(r => r.isFTB && r.hasQCAccess).length} FTB with QC Access
        </span>
      </div>
    </div>
  );
}
