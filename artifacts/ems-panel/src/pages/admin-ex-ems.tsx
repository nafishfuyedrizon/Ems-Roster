import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Search, CheckSquare, Square, UserSearch, X } from "lucide-react";
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

type Member = { id: number; callSign: string; name: string; rank: string; discordId?: string | null; discordUsername?: string | null; licenseKey?: string | null; medTrex?: string | null; };

export default function AdminExEms() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { adminIdentity } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [rankFilter, setRankFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExEms | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ExEms | null>(null);

  // Member search in dialog
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [convertMemberId, setConvertMemberId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: rows = [], isLoading } = useQuery<ExEms[]>({
    queryKey: ["ex-ems"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/ex-ems`);
      return r.json();
    },
  });

  // Fetch active members for search
  const { data: activeMembers = [] } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/members`);
      return r.json();
    },
  });

  const filteredMemberDropdown = memberSearch.length >= 1
    ? activeMembers.filter(m =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.callSign.toLowerCase().includes(memberSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // If a member was selected from search, use convert endpoint
      if (convertMemberId) {
        const r = await fetch(`${API_BASE}/ex-ems/convert/${convertMemberId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exitStatus: data.exitStatus,
            exitDate: data.exitDate,
            isFighter: data.isFighter,
            isRru: data.isRru,
            isTvu: data.isTvu,
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }
      const url = editing ? `${API_BASE}/ex-ems/${editing.id}` : `${API_BASE}/ex-ems`;
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ex-ems"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({ title: convertMemberId ? `${selectedMember?.name} moved to Ex EMS` : editing ? "Record updated" : "Ex EMS added" });
      setDialogOpen(false);
      setConvertMemberId(null);
      setSelectedMember(null);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API_BASE}/ex-ems/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ex-ems"] });
      toast({ title: "Record deleted" });
      setDeleteTarget(null);
    },
  });

  const selectMember = (m: Member) => {
    setSelectedMember(m);
    setConvertMemberId(m.id);
    setMemberSearch("");
    setShowDropdown(false);
    // Auto-fill form fields from member
    setForm(f => ({
      ...f,
      callSign: m.callSign,
      name: m.name,
      rank: m.rank,
      discordId: m.discordId ?? "",
      discordUsername: m.discordUsername ?? "",
      licenseId: m.licenseKey ?? "",
      isMedevacAdvanced: m.medTrex === "Advance",
      isMedevacTrainee: m.medTrex === "Trainee",
    }));
  };

  const clearSelectedMember = () => {
    setSelectedMember(null);
    setConvertMemberId(null);
    setForm(DEFAULT_FORM);
  };

  const todayFormatted = () => {
    const d = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, exitDate: todayFormatted(), addedBy: adminIdentity || "" });
    setSelectedMember(null);
    setConvertMemberId(null);
    setMemberSearch("");
    setDialogOpen(true);
  };
  const openEdit = (row: ExEms) => {
    setEditing(row);
    setForm({
      callSign: row.callSign, name: row.name, rank: row.rank,
      discordId: row.discordId ?? "", discordUsername: row.discordUsername ?? "", licenseId: row.licenseId ?? "",
      exitStatus: row.exitStatus, proof: row.proof ?? "",
      exitDate: row.exitDate ?? "",
      isFighter: row.isFighter, isRru: row.isRru, isTvu: row.isTvu,
      isMedevacAdvanced: row.isMedevacAdvanced, isMedevacTrainee: row.isMedevacTrainee,
      notes: row.notes ?? "", addedBy: row.addedBy ?? "",
    });
    setDialogOpen(true);
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.callSign.toLowerCase().includes(q) ||
      (r.discordUsername ?? "").toLowerCase().includes(q) ||
      (r.discordId ?? "").toLowerCase().includes(q) ||
      (r.licenseId ?? "").toLowerCase().includes(q) ||
      r.rank.toLowerCase().includes(q);
    const matchStatus = statusFilter === "ALL" || r.exitStatus === statusFilter;
    const matchRank   = rankFilter === "ALL"   || r.rank === rankFilter;
    return matchSearch && matchStatus && matchRank;
  });

  const uniqueRanks = Array.from(new Set(rows.map(r => r.rank))).sort();

  const setField = (k: keyof FormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-widest text-foreground">Ex EMS Records</h2>
          <p className="text-xs text-muted-foreground font-mono">Former personnel database</p>
        </div>
        <Button size="sm" onClick={openAdd} className="h-8 gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Ex EMS
        </Button>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Name, call sign, discord, license..."
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
        <select
          className="h-8 rounded-md border border-input px-2 text-xs font-mono"
          style={{ backgroundColor: "#0f1117", color: "#e2e8f0" }}
          value={rankFilter}
          onChange={e => setRankFilter(e.target.value)}
        >
          <option value="ALL">All Ranks</option>
          {uniqueRanks.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(search || statusFilter !== "ALL" || rankFilter !== "ALL") && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("ALL"); setRankFilter("ALL"); }}
            className="h-8 px-3 rounded border border-border/40 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-border flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          Showing <span className="text-foreground font-bold">{filtered.length}</span> / {rows.length}
        </span>
      </div>

      {/* Stats row — clickable status filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "px-3 py-1.5 rounded border text-xs font-mono transition-all",
            statusFilter === "ALL"
              ? "bg-primary/20 border-primary/40 text-primary"
              : "bg-card/50 border-border/40 text-muted-foreground hover:border-border"
          )}
        >
          Total: <span className="font-bold">{rows.length}</span>
        </button>
        {EXIT_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(prev => prev === s ? "ALL" : s)}
            className={cn(
              "px-3 py-1.5 rounded border text-xs font-mono transition-all",
              statusFilter === s
                ? EXIT_COLORS[s] + " ring-1 ring-current"
                : "bg-muted/10 border-border/30 text-muted-foreground hover:border-border"
            )}
          >
            {s}: <span className="font-bold">{rows.filter(r => r.exitStatus === s).length}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider w-20">Call Sign</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Discord Username</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Rank</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Discord ID</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">License ID</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Exit Date</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">FF</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">RRU</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">TVU</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Med Adv</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Med Tr</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 14 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground font-mono text-xs py-12">
                    No Ex EMS records found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(row => (
                  <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-primary">{row.callSign}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-sky-300">{row.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.addedBy || "—"}</TableCell>
                    <TableCell><RankBadge rank={row.rank} /></TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground max-w-[120px] truncate" title={row.discordId ?? ""}>{row.discordId || "—"}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground/70 max-w-[140px] truncate" title={row.licenseId ?? ""}>{row.licenseId || "—"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] font-mono border", EXIT_COLORS[row.exitStatus] ?? "")}>
                        {row.exitStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.exitDate || "—"}</TableCell>
                    <TableCell className="text-center"><BoolCell val={row.isFighter} /></TableCell>
                    <TableCell className="text-center"><BoolCell val={row.isRru} /></TableCell>
                    <TableCell className="text-center"><BoolCell val={row.isTvu} /></TableCell>
                    <TableCell className="text-center"><BoolCell val={row.isMedevacAdvanced} /></TableCell>
                    <TableCell className="text-center"><BoolCell val={row.isMedevacTrainee} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(row)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteTarget(row)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setSelectedMember(null); setConvertMemberId(null); } }}>
        <DialogContent className="max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm font-bold">
              {editing ? "Edit Ex EMS Record" : "Add Ex EMS Record"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Member Search (Add mode only) */}
            {!editing && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <label className="text-[10px] font-mono uppercase tracking-wider text-primary/80 flex items-center gap-1.5 mb-2">
                  <UserSearch className="w-3.5 h-3.5" /> Search Active EMS Member
                </label>
                {selectedMember ? (
                  <div className="flex items-center justify-between bg-card rounded border border-emerald-500/30 px-3 py-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-emerald-400">{selectedMember.callSign}</span>
                      <span className="font-mono text-xs text-foreground ml-2">{selectedMember.name}</span>
                      <span className="font-mono text-xs text-muted-foreground ml-2">· {selectedMember.rank}</span>
                    </div>
                    <button onClick={clearSelectedMember} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        className="pl-8 h-8 text-xs font-mono bg-card"
                        placeholder="Search by name or call sign..."
                        value={memberSearch}
                        onChange={e => { setMemberSearch(e.target.value); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                      />
                    </div>
                    {showDropdown && filteredMemberDropdown.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-lg shadow-xl overflow-hidden">
                        {filteredMemberDropdown.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/10 transition-colors border-b border-border/20 last:border-0"
                            onClick={() => selectMember(m)}
                          >
                            <span className="font-mono text-xs font-bold text-primary w-16 shrink-0">{m.callSign}</span>
                            <span className="font-mono text-xs text-foreground flex-1">{m.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{m.rank}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showDropdown && memberSearch.length >= 1 && filteredMemberDropdown.length === 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono">
                        No active members found
                      </div>
                    )}
                  </div>
                )}
                {convertMemberId && (
                  <p className="text-[10px] text-amber-400/80 font-mono mt-1.5">
                    ⚠ This will remove them from EMS roster and Qual Chart automatically.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Call Sign *</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.callSign} onChange={e => setField("callSign", e.target.value)} placeholder="X-100" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Discord Username *</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. nafish_07" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Name <span className="text-primary/60 normal-case font-sans">(who added this record — auto filled)</span></label>
                <Input
                  className="mt-1 h-8 text-xs font-mono bg-primary/5 border-primary/20"
                  value={form.addedBy ?? ""}
                  onChange={e => setField("addedBy", e.target.value)}
                  placeholder="Admin name"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Rank *</label>
                <select
                  className="mt-1 w-full h-8 rounded-md border border-input px-2 text-xs font-mono"
                  style={{ backgroundColor: "#0f1117", color: "#e2e8f0" }}
                  value={form.rank}
                  onChange={e => setField("rank", e.target.value)}
                >
                  <option value="">Select rank</option>
                  {EMS_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Exit Status</label>
                <select
                  className="mt-1 w-full h-8 rounded-md border border-input px-2 text-xs font-mono"
                  style={{ backgroundColor: "#0f1117", color: "#e2e8f0" }}
                  value={form.exitStatus}
                  onChange={e => setField("exitStatus", e.target.value)}
                >
                  {EXIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Discord Username</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.discordUsername ?? ""} onChange={e => setField("discordUsername", e.target.value)} placeholder="e.g. nafish_07" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Discord ID</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.discordId ?? ""} onChange={e => setField("discordId", e.target.value)} placeholder="e.g. 1286283853186596904" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Exit Date</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.exitDate ?? ""} onChange={e => setField("exitDate", e.target.value)} placeholder="5-Apr-2025" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">License ID / Steam Hex</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.licenseId ?? ""} onChange={e => setField("licenseId", e.target.value)} placeholder="license:abc..." />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Proof</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.proof ?? ""} onChange={e => setField("proof", e.target.value)} placeholder="Removed" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes</label>
                <Input className="mt-1 h-8 text-xs font-mono" value={form.notes ?? ""} onChange={e => setField("notes", e.target.value)} placeholder="Optional notes" />
              </div>
            </div>

            {/* Boolean checkboxes */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">Qualifications</label>
              <div className="grid grid-cols-5 gap-2">
                {([
                  ["isFighter", "Fire Fighter"],
                  ["isRru", "RRU"],
                  ["isTvu", "TVU"],
                  ["isMedevacAdvanced", "MedEvac Adv"],
                  ["isMedevacTrainee", "MedEvac Tr"],
                ] as [keyof FormData, string][]).map(([key, label]) => (
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
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add Record"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-destructive uppercase text-sm">Delete Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="text-foreground font-semibold">{deleteTarget?.name}</span> ({deleteTarget?.callSign}) from Ex EMS? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
