import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Search, CheckSquare, Square, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { EMS_RANKS, RANK_COLORS } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { API_BASE } from "@/lib/api-base";

const EXIT_STATUSES = ["RESIGNED", "FIRED", "REMOVED", "Terminated"];

const EXIT_COLORS: Record<string, string> = {
  RESIGNED:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  FIRED:      "bg-red-500/10 text-red-400 border-red-500/30",
  REMOVED:    "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Terminated: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

type ExEms = {
  id: number; callSign: string; name: string; rank: string;
  discordId: string | null; discordUsername: string | null; licenseId: string | null;
  exitStatus: string; proof: string | null; exitDate: string | null;
  isFighter: boolean; isRru: boolean; isTvu: boolean;
  isMedevacAdvanced: boolean; isMedevacTrainee: boolean;
  notes: string | null; addedBy: string | null; createdAt: string;
};

type FormData = Omit<ExEms, "id" | "createdAt">;

const DEFAULT_FORM: FormData = {
  callSign: "", name: "", rank: "", discordId: "", discordUsername: "", licenseId: "",
  exitStatus: "RESIGNED", proof: "Removed", exitDate: "",
  isFighter: false, isRru: false, isTvu: false,
  isMedevacAdvanced: false, isMedevacTrainee: false, notes: "", addedBy: "",
};

function BoolCell({ val }: { val: boolean }) {
  return val
    ? <CheckSquare className="w-4 h-4 text-emerald-400 mx-auto" />
    : <Square className="w-4 h-4 text-muted-foreground/30 mx-auto" />;
}

function RankBadge({ rank }: { rank: string }) {
  const c = RANK_COLORS[rank];
  if (!c) return <span className="font-mono text-xs text-muted-foreground">{rank}</span>;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono border", c.bg, c.text, c.border)}>
      {rank}
    </span>
  );
}

export default function AdminHcFtb() {
  const { adminIdentity } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [qualFilter, setQualFilter]   = useState<string>("ALL");
  const [editing, setEditing] = useState<ExEms | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExEms | null>(null);
  const [form, setForm] = useState<FormData>({ ...DEFAULT_FORM });

  const { data: allRows = [], isLoading } = useQuery<ExEms[]>({
    queryKey: ["ex-ems"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/ex-ems`);
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  const rows = allRows.filter(r => r.isFighter || r.isRru || r.isTvu || r.isMedevacAdvanced || r.isMedevacTrainee);

  const QUAL_MAP: Record<string, keyof ExEms> = {
    HC:  "isFighter",
    SUP: "isMedevacAdvanced",
    ADV: "isTvu",
    TRN: "isMedevacTrainee",
    REC: "isRru",
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.callSign.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      (r.discordUsername ?? "").toLowerCase().includes(q) ||
      (r.discordId ?? "").toLowerCase().includes(q) ||
      (r.licenseId ?? "").toLowerCase().includes(q) ||
      r.rank.toLowerCase().includes(q);
    const matchStatus = statusFilter === "ALL" || r.exitStatus === statusFilter;
    const matchQual   = qualFilter === "ALL"   || r[QUAL_MAP[qualFilter] as keyof ExEms] === true;
    return matchSearch && matchStatus && matchQual;
  });

  const setField = (k: keyof FormData, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = editing ? `${API_BASE}/ex-ems/${editing.id}` : `${API_BASE}/ex-ems`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, performedBy: adminIdentity }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ex-ems"] });
      closeDialog();
      toast({ title: editing ? "Record updated" : "HC/FTB record added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API_BASE}/ex-ems/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ performedBy: adminIdentity }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ex-ems"] });
      setDeleteTarget(null);
      toast({ title: "Record deleted" });
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM });
    setIsAdding(true);
  };

  const openEdit = (row: ExEms) => {
    setEditing(row);
    setForm({
      callSign: row.callSign, name: row.name, rank: row.rank,
      discordId: row.discordId ?? "", discordUsername: row.discordUsername ?? "",
      licenseId: row.licenseId ?? "", exitStatus: row.exitStatus,
      proof: row.proof ?? "Removed", exitDate: row.exitDate ?? "",
      isFighter: row.isFighter, isRru: row.isRru, isTvu: row.isTvu,
      isMedevacAdvanced: row.isMedevacAdvanced, isMedevacTrainee: row.isMedevacTrainee,
      notes: row.notes ?? "", addedBy: row.addedBy ?? "",
    });
    setIsAdding(true);
  };

  const closeDialog = () => { setIsAdding(false); setEditing(null); setForm({ ...DEFAULT_FORM }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.callSign || !form.name || !form.rank) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-widest text-orange-400">Ex HC/FTB Chart</h2>
          <p className="text-xs text-muted-foreground font-mono">Former High Command & FTP personnel</p>
        </div>
        <Button size="sm" onClick={openAdd} className="h-8 gap-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20">
          <Plus className="w-3.5 h-3.5" /> Add Record
        </Button>
      </div>

      {/* Search + rank filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Name, call sign, discord, license, rank..."
            className="pl-8 h-8 text-xs bg-muted/30 w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {(search || statusFilter !== "ALL" || qualFilter !== "ALL") && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("ALL"); setQualFilter("ALL"); }}
            className="h-8 px-3 rounded border border-orange-500/30 text-[10px] font-mono text-orange-400/70 hover:text-orange-400 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear Filters
          </button>
        )}
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          Showing <span className="text-orange-400 font-bold">{filtered.length}</span> / {rows.length}
        </span>
      </div>

      {/* FTB Qual filter — clickable badges */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Filter by FTB Qualification</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setQualFilter("ALL")}
            className={cn(
              "px-3 py-1.5 rounded border text-xs font-mono transition-all",
              qualFilter === "ALL"
                ? "bg-orange-500/20 border-orange-500/50 text-orange-300 ring-1 ring-orange-500/50"
                : "bg-card/50 border-border/40 text-muted-foreground hover:border-border"
            )}
          >
            All: <span className="font-bold">{rows.length}</span>
          </button>
          {([
            ["HC",  "High Command",   "isFighter",        "bg-orange-500/10 text-orange-400 border-orange-500/30",  "bg-orange-500/20 border-orange-500/50 text-orange-300"],
            ["SUP", "FTP Supervisor", "isMedevacAdvanced","bg-cyan-500/10 text-cyan-400 border-cyan-500/30",         "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"],
            ["ADV", "FTP Advanced",   "isTvu",            "bg-purple-500/10 text-purple-400 border-purple-500/30",   "bg-purple-500/20 border-purple-500/50 text-purple-300"],
            ["TRN", "FTP Trainer",    "isMedevacTrainee", "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",   "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"],
            ["REC", "FTP Recruit",    "isRru",            "bg-blue-500/10 text-blue-400 border-blue-500/30",         "bg-blue-500/20 border-blue-500/50 text-blue-300"],
          ] as [string, string, keyof ExEms, string, string][]).map(([key, label, field, inactiveClass, activeClass]) => (
            <button
              key={key}
              onClick={() => setQualFilter(prev => prev === key ? "ALL" : key)}
              className={cn(
                "px-3 py-1.5 rounded border text-xs font-mono transition-all",
                qualFilter === key
                  ? activeClass + " ring-1 ring-current"
                  : "bg-muted/10 border-border/30 text-muted-foreground hover:border-border"
              )}
            >
              {label}: <span className="font-bold">{rows.filter(r => r[field]).length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Exit Status filter — clickable */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "px-2.5 py-1 rounded border text-[10px] font-mono transition-all",
            statusFilter === "ALL"
              ? "bg-primary/20 border-primary/40 text-primary"
              : "bg-card/40 border-border/30 text-muted-foreground hover:border-border"
          )}
        >
          All Status
        </button>
        {EXIT_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(prev => prev === s ? "ALL" : s)}
            className={cn(
              "px-2.5 py-1 rounded border text-[10px] font-mono transition-all",
              statusFilter === s
                ? EXIT_COLORS[s] + " ring-1 ring-current"
                : "bg-muted/10 border-border/30 text-muted-foreground hover:border-border"
            )}
          >
            {s}: <span className="font-bold">{rows.filter(r => r.exitStatus === s).length}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-orange-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-orange-500/5 hover:bg-orange-500/5">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider w-20">Call Sign</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Discord Username</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Rank</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">License ID</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Exit Date</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center text-orange-400">High Command</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center text-cyan-400">FTP Supervisor</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center text-purple-400">FTP Advanced</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center text-yellow-400">FTP Trainer</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center text-blue-400">FTP Recruit</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 13 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-10 text-muted-foreground font-mono text-sm">
                    No HC/FTB records found
                  </TableCell>
                </TableRow>
              ) : filtered.map(row => (
                <TableRow key={row.id} className="hover:bg-orange-500/5 border-border/30">
                  <TableCell className="font-mono text-xs font-bold text-orange-400">{row.callSign}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{row.discordUsername ?? "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{row.name}</TableCell>
                  <TableCell><RankBadge rank={row.rank} /></TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate" title={row.licenseId ?? ""}>
                    {row.licenseId ? row.licenseId.slice(0, 16) + "…" : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border font-mono", EXIT_COLORS[row.exitStatus] ?? "bg-muted/20 text-muted-foreground border-border/30")}>
                      {row.exitStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{row.exitDate ?? "—"}</TableCell>
                  <TableCell className="text-center"><BoolCell val={row.isFighter} /></TableCell>
                  <TableCell className="text-center"><BoolCell val={row.isMedevacAdvanced} /></TableCell>
                  <TableCell className="text-center"><BoolCell val={row.isTvu} /></TableCell>
                  <TableCell className="text-center"><BoolCell val={row.isMedevacTrainee} /></TableCell>
                  <TableCell className="text-center"><BoolCell val={row.isRru} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(row)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400" onClick={() => setDeleteTarget(row)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAdding} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-orange-500/20">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest text-sm text-orange-400">
              {editing ? "Edit HC/FTB Record" : "Add HC/FTB Record"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Call Sign *</label>
                <Input className="h-8 text-xs bg-muted/20" value={form.callSign} onChange={e => setField("callSign", e.target.value)} placeholder="X-100" required />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Name *</label>
                <Input className="h-8 text-xs bg-muted/20" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Discord username" required />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Rank *</label>
                <select
                  className="w-full h-8 rounded-md border border-input px-2 text-xs font-mono"
                  style={{ backgroundColor: "#0f1117", color: "#e2e8f0" }}
                  value={form.rank}
                  onChange={e => setField("rank", e.target.value)}
                  required
                >
                  <option value="">Select rank</option>
                  {EMS_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="Director">Director</option>
                  <option value="Deputy Director">Deputy Director</option>
                  <option value="Assistant Director">Assistant Director</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Exit Status</label>
                <select
                  className="w-full h-8 rounded-md border border-input px-2 text-xs font-mono"
                  style={{ backgroundColor: "#0f1117", color: "#e2e8f0" }}
                  value={form.exitStatus}
                  onChange={e => setField("exitStatus", e.target.value)}
                >
                  {EXIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Discord Username</label>
                <Input className="h-8 text-xs bg-muted/20" value={form.discordUsername ?? ""} onChange={e => setField("discordUsername", e.target.value)} placeholder="username#0000" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Exit Date</label>
                <Input className="h-8 text-xs bg-muted/20" type="date" value={form.exitDate ?? ""} onChange={e => setField("exitDate", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">License ID</label>
                <Input className="h-8 text-xs bg-muted/20 font-mono" value={form.licenseId ?? ""} onChange={e => setField("licenseId", e.target.value)} placeholder="license:abc123..." />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Notes</label>
                <Input className="h-8 text-xs bg-muted/20" value={form.notes ?? ""} onChange={e => setField("notes", e.target.value)} placeholder="Optional notes" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">High Command / FTP Qualifications</label>
              <div className="grid grid-cols-5 gap-2">
                {([
                  ["isFighter", "High Command", "text-orange-400"],
                  ["isMedevacAdvanced", "FTP Supervisor", "text-cyan-400"],
                  ["isTvu", "FTP Advanced", "text-purple-400"],
                  ["isMedevacTrainee", "FTP Trainer", "text-yellow-400"],
                  ["isRru", "FTP Recruit", "text-blue-400"],
                ] as [keyof FormData, string, string][]).map(([key, label, color]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setField(key, !form[key])}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded border text-[10px] font-mono transition-all",
                      form[key]
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                        : "bg-muted/10 border-border/30 text-muted-foreground hover:border-border"
                    )}
                  >
                    {form[key] ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    <span className={form[key] ? "" : color}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" size="sm" disabled={saveMutation.isPending} className="bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20">
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md bg-background border-red-500/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-sm text-red-400">
              <AlertTriangle className="w-4 h-4" /> Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="text-foreground font-semibold">{deleteTarget?.name}</span> ({deleteTarget?.callSign}) from Ex HC/FTB Chart? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
