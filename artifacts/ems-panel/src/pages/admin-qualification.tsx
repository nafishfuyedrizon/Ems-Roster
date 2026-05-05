import { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, ChevronDown, ChevronUp, RefreshCw, Zap, Search, X, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { API_BASE } from "@/lib/api-base";

const HC_RANKS = ["Director", "Deputy Director", "Assistant Director", "Captain", "Lieutenant", "Sergeant First Class", "Sergeant"];

interface QRow {
  id: number;
  callSign: string;
  memberName: string | null;
  rank: string;
  minSeniorityDays: string | null;
  daysInPresentRank: string | null;
  minDutyHours: string | null;
  lastPromotionDate: string | null;
  dutyTimeInRank: string | null;
  status: string | null;
  memberStatus: string | null;
  voteByHC: string | null;
  notes: string | null;
  sortOrder: number;
  computedDaysInRank: number | null;
  computedDutyTime: string | null;
  loaDaysInRank: number;
  computedLOADays: number;
  isCurrentlyOnLOA: boolean;
  ongoingLOADays: number;
  linkedMemberId: number | null;
}

const STATUS_OPTIONS = [
  "", "LEGEND", "QUALIFIED", "NOT QUALIFIED",
  "DAYS NOT COMPLETE", "HOURS NOT COMPLETE",
  "SPECIALIST QUALIFIED", "SERGEANT QUALIFIED", "PENDING VOTE",
];

const EMS_RANKS = [
  "Director", "Deputy Director", "Assistant Director", "Captain", "Lieutenant",
  "Sergeant First Class", "Sergeant", "Senior Specialist", "Specialist",
  "Senior Paramedic", "Paramedic", "EMT",
];

const STATUS_COLORS: Record<string, string> = {
  LEGEND:                "bg-amber-500/20 text-amber-300 border-amber-500/40",
  QUALIFIED:             "bg-green-500/20 text-green-300 border-green-500/40",
  "NOT QUALIFIED":       "bg-red-500/20 text-red-300 border-red-500/40",
  "DAYS NOT COMPLETE":   "bg-orange-500/20 text-orange-300 border-orange-500/40",
  "HOURS NOT COMPLETE":  "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  "SPECIALIST QUALIFIED":"bg-teal-500/20 text-teal-300 border-teal-500/40",
  "SERGEANT QUALIFIED":  "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "PENDING VOTE":        "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

const statusBadge = (s: string | null) => {
  if (!s) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap border ${STATUS_COLORS[s] ?? "bg-muted text-muted-foreground border-border"}`}>
      {s}
    </span>
  );
};

const RANK_ORDER = [
  "Director", "Deputy Director", "Assistant Director", "Captain", "Lieutenant",
  "Sergeant First Class", "Sergeant", "Senior Specialist", "Specialist",
  "Senior Paramedic", "Paramedic", "EMT",
];

const rankColor: Record<string, string> = {
  Director:               "text-amber-400",
  "Deputy Director":      "text-amber-300",
  "Assistant Director":   "text-yellow-400",
  Captain:                "text-blue-400",
  Lieutenant:             "text-blue-300",
  "Sergeant First Class": "text-cyan-400",
  Sergeant:               "text-cyan-300",
  "Senior Specialist":    "text-green-400",
  Specialist:             "text-green-300",
  "Senior Paramedic":     "text-teal-400",
  Paramedic:              "text-teal-300",
  EMT:                    "text-slate-300",
};

type EditState = {
  callSign: string;
  memberName: string;
  rank: string;
  minSeniorityDays: string;
  minDutyHours: string;
  lastPromotionDate: string;
  status: string;
  notes: string;
};

const emptyForm = (): EditState => ({
  callSign: "", memberName: "", rank: "EMT",
  minSeniorityDays: "", minDutyHours: "",
  lastPromotionDate: "", status: "", notes: "",
});

const SectionHeader = ({ label }: { label: string }) => (
  <p className="text-xs font-mono uppercase text-primary/70 tracking-widest mb-3 border-b border-border/30 pb-1">
    {label}
  </p>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block font-mono text-xs uppercase text-muted-foreground mb-1">
    {children}
  </label>
);

// ─── HC Multi-Voter Select Component ─────────────────────────────────────────
function HCVoterSelect({
  voters,
  onChange,
  hcMembers,
}: {
  voters: string[];
  onChange: (v: string[]) => void;
  hcMembers: string[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addVoter = (name: string) => {
    if (!voters.includes(name)) onChange([...voters, name]);
    setSearch("");
  };

  const removeVoter = (name: string) => {
    onChange(voters.filter(v => v !== name));
  };

  const filtered = hcMembers.filter(
    m => !voters.includes(m) && m.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected Voters */}
      <div
        className="min-h-[42px] border border-border rounded-md bg-background px-2 py-1.5 cursor-text"
        onClick={() => setOpen(true)}
      >
        <div className="flex flex-wrap gap-1.5 mb-1">
          {voters.map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1 bg-green-500/20 text-green-300 border border-green-500/40 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            >
              {v}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeVoter(v); }}
                className="ml-0.5 text-green-300/70 hover:text-red-400 transition-colors rounded-full hover:bg-red-400/10 w-3.5 h-3.5 flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-1.5 px-0.5">
          <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <input
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none min-w-0"
            placeholder={voters.length === 0 ? "Search HC member to add vote..." : "Add more..."}
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 border border-border rounded-md bg-card shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2 text-center">
              {hcMembers.length === 0 ? "Loading HC members..." : "No HC members found"}
            </p>
          ) : (
            filtered.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => addVoter(m)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-foreground">{m}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminQualification({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedRanks, setCollapsedRanks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [hcMembers, setHcMembers] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<QRow | null>(null);
  const [form, setForm] = useState<EditState>(emptyForm());
  const [voters, setVoters] = useState<string[]>([]);

  // Rank-level settings modal
  const [rankModalOpen, setRankModalOpen] = useState(false);
  const [rankModalRank, setRankModalRank] = useState("");
  const [rankMinSeniority, setRankMinSeniority] = useState("");
  const [rankMinDuty, setRankMinDuty] = useState("");
  const [rankSaving, setRankSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/qualification-chart`);
      const data = await res.json();
      setRows(data);
    } catch { setError("Failed to load qualification chart."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API_BASE}/members`)
      .then(r => r.json())
      .then((data: { name: string; rank: string }[]) => {
        const hc = data
          .filter(m => HC_RANKS.includes(m.rank))
          .map(m => m.name)
          .sort();
        setHcMembers(hc);
      })
      .catch(() => {});
  }, []);

  const openEdit = (row: QRow) => {
    setEditingRow(row);
    setForm({
      callSign: row.callSign,
      memberName: row.memberName ?? "",
      rank: row.rank,
      minSeniorityDays: row.minSeniorityDays ?? "",
      minDutyHours: row.minDutyHours ?? "",
      lastPromotionDate: row.lastPromotionDate ?? "",
      status: row.status ?? "",
      notes: row.notes ?? "",
    });
    // Parse comma-separated voters into array
    setVoters(
      row.voteByHC
        ? row.voteByHC.split(",").map(v => v.trim()).filter(Boolean)
        : []
    );
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const payload = { ...form, voteByHC: voters.join(", ") };
      const res = await fetch(`${API_BASE}/qualification-chart/${editingRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setRows(prev => prev.map(r => r.id === editingRow.id ? { ...r, ...updated } : r));
      setModalOpen(false);
    } catch { setError("Failed to save changes."); }
    finally { setSaving(false); }
  };

  const openRankSettings = (rank: string, rankRows: QRow[], e: React.MouseEvent) => {
    e.stopPropagation();
    const sample = rankRows[0];
    setRankModalRank(rank);
    setRankMinSeniority(sample?.minSeniorityDays ?? "");
    setRankMinDuty(sample?.minDutyHours ?? "");
    setRankModalOpen(true);
  };

  const handleRankSave = async () => {
    setRankSaving(true);
    try {
      const res = await fetch(`${API_BASE}/qualification-chart/rank-settings/${encodeURIComponent(rankModalRank)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSeniorityDays: rankMinSeniority, minDutyHours: rankMinDuty }),
      });
      if (!res.ok) throw new Error("Failed");
      setRows(prev => prev.map(r =>
        r.rank === rankModalRank
          ? { ...r, minSeniorityDays: rankMinSeniority, minDutyHours: rankMinDuty }
          : r
      ));
      setRankModalOpen(false);
    } catch { setError("Failed to save rank settings."); }
    finally { setRankSaving(false); }
  };

  const toggleRank = (rank: string) =>
    setCollapsedRanks(prev => {
      const s = new Set(prev);
      s.has(rank) ? s.delete(rank) : s.add(rank);
      return s;
    });

  const setField = (f: keyof EditState, v: string) =>
    setForm(prev => ({ ...prev, [f]: v }));

  const isLifetime = ["Lifetime", "lifetime"].includes(editingRow?.lastPromotionDate ?? "");

  const grouped = RANK_ORDER.map(rank => ({
    rank,
    rows: rows.filter(r => r.rank === rank),
  })).filter(g => g.rows.length > 0);

  const otherRows = rows.filter(r => !RANK_ORDER.includes(r.rank));
  if (otherRows.length > 0) grouped.push({ rank: "Other", rows: otherRows });

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded p-3 text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-lg leading-none hover:text-red-300">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Qualification Chart</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows.length} members · auto-synced from Personnel ·{" "}
            <span className="text-cyan-400 inline-flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" /> = auto-calculated from duty logs
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground px-3 py-1.5 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Rank Groups */}
      <div className="space-y-3">
        {grouped.map(({ rank, rows: rankRows }) => {
          const collapsed = collapsedRanks.has(rank);
          return (
            <div key={rank} className="border border-border/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleRank(rank)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-card/70 hover:bg-card/90 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-sm ${rankColor[rank] ?? "text-foreground"}`}>{rank}</span>
                  <span className="text-xs text-muted-foreground">{rankRows.length} member{rankRows.length !== 1 ? "s" : ""}</span>
                  {/* Min Seniority & Min Duty inline preview */}
                  {rankRows[0] && (
                    <span className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground/70">
                      <span>Seniority: <span className="text-foreground/80 font-mono">{rankRows[0].minSeniorityDays || "—"}</span></span>
                      <span>·</span>
                      <span>Min Duty: <span className="text-foreground/80 font-mono">{rankRows[0].minDutyHours ? `${rankRows[0].minDutyHours}h` : "—"}</span></span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={(e) => openRankSettings(rank, rankRows, e)}
                      title={`Edit Min Seniority & Min Duty for all ${rank}s`}
                      className="p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors flex items-center gap-1 text-[10px] font-mono"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Requirements</span>
                    </button>
                  )}
                  {collapsed
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {!collapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-background/40 border-b border-border/50">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Call Sign</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Name</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Min Seniority</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                          Days in Rank <Zap className="w-2.5 h-2.5 inline text-cyan-400" />
                        </th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Min Duty</th>
                        <th className="text-left px-3 py-2 text-orange-400/80 font-medium whitespace-nowrap">LOA Days</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Last Promotion</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                          Duty in Rank <Zap className="w-2.5 h-2.5 inline text-cyan-400" />
                        </th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Status</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Voted by HC</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Notes</th>
                        {canEdit && <th className="px-3 py-2 w-20" />}
                      </tr>
                    </thead>
                    <tbody>
                      {rankRows.map(row => {
                        const isRowLifetime = ["Lifetime", "lifetime"].includes(row.lastPromotionDate ?? "");
                        const rowVoters = row.voteByHC
                          ? row.voteByHC.split(",").map(v => v.trim()).filter(Boolean)
                          : [];
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-border/30 hover:bg-card/40 transition-colors"
                          >
                            <td className="px-3 py-2 font-mono font-bold text-primary whitespace-nowrap">{row.callSign}</td>
                            <td className="px-3 py-2 text-foreground whitespace-nowrap">
                              {row.memberName}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.minSeniorityDays || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono">
                              {isRowLifetime
                                ? <span className="text-amber-300">Lifetime</span>
                                : row.computedDaysInRank !== null
                                  ? <span className="text-cyan-300">{row.computedDaysInRank}</span>
                                  : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {row.minDutyHours === "Lifetime"
                                ? <span className="text-amber-300">Lifetime</span>
                                : row.minDutyHours ? `${row.minDutyHours}h` : "—"}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono">
                              {row.computedLOADays > 0
                                ? (
                                  <span className="text-orange-400 font-semibold">
                                    {row.computedLOADays}d
                                    {row.isCurrentlyOnLOA && row.ongoingLOADays > 0 && (
                                      <span className="text-orange-300/60 text-[10px] ml-1">(+{row.ongoingLOADays} active)</span>
                                    )}
                                  </span>
                                )
                                : row.isCurrentlyOnLOA
                                  ? <span className="text-orange-400/60 text-[10px]">LOA day 0</span>
                                  : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.lastPromotionDate || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-mono">
                              {isRowLifetime
                                ? <span className="text-amber-300">Lifetime</span>
                                : row.computedDutyTime !== null
                                  ? <span className="text-cyan-300">{row.computedDutyTime}</span>
                                  : row.dutyTimeInRank
                                    ? <span className="text-foreground">{row.dutyTimeInRank}</span>
                                    : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{statusBadge(row.status)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {rowVoters.length === 0
                                ? <span className="text-muted-foreground">—</span>
                                : <div className="flex flex-wrap gap-1">
                                    {rowVoters.map(v => (
                                      <span key={v} className="inline-block bg-green-500/15 text-green-300 border border-green-500/30 rounded-full px-2 py-0 text-[10px] font-semibold">
                                        {v}
                                      </span>
                                    ))}
                                  </div>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{row.notes || "—"}</td>
                            {canEdit && (
                              <td className="px-2 py-2">
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => openEdit(row)}
                                    title="Edit"
                                    className="p-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Edit / Add Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[620px] bg-card border-border/50 text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase font-bold tracking-wider text-sm">
              Edit Qualification Record
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">

            {/* ─ Member (read-only from Personnel) ─ */}
            <div>
              <SectionHeader label="Member" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Call Sign</FieldLabel>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border/50 bg-background/30 font-mono text-sm text-primary">
                    {form.callSign}
                  </div>
                </div>
                <div>
                  <FieldLabel>Character Name</FieldLabel>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border/50 bg-background/30 text-sm text-foreground">
                    {form.memberName || <span className="text-muted-foreground italic">—</span>}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                Name and call sign are managed from the Personnel tab.
              </p>
            </div>

            {/* ─ Qualification ─ */}
            <div>
              <SectionHeader label="Qualification" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Rank</FieldLabel>
                  <Select value={form.rank} onValueChange={v => setField("rank", v)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMS_RANKS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Min Seniority (days)</FieldLabel>
                  <Input
                    value={form.minSeniorityDays}
                    onChange={e => setField("minSeniorityDays", e.target.value)}
                    className="bg-background font-mono"
                    placeholder="e.g. 63(9 Weeks)"
                  />
                </div>
                <div>
                  <FieldLabel>Min Duty Hours</FieldLabel>
                  <Input
                    value={form.minDutyHours}
                    onChange={e => setField("minDutyHours", e.target.value)}
                    className="bg-background font-mono"
                    placeholder="e.g. 120"
                  />
                </div>
                <div>
                  <FieldLabel>Last Promotion Date</FieldLabel>
                  <Input
                    value={form.lastPromotionDate}
                    onChange={e => setField("lastPromotionDate", e.target.value)}
                    className="bg-background font-mono"
                    placeholder="DD-MM-YYYY or Lifetime"
                  />
                </div>
              </div>
            </div>

            {/* ─ Live Progress (read-only) ─ */}
            {editingRow && (
              <div>
                <SectionHeader label="Live Progress (Auto-Calculated)" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/50 border border-border/50 rounded-md px-3 py-2.5">
                    <p className="font-mono text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1">
                      Days in Rank <Zap className="w-2.5 h-2.5 text-cyan-400" />
                    </p>
                    {isLifetime
                      ? <p className="text-amber-300 font-bold text-sm font-mono">Lifetime</p>
                      : editingRow.computedDaysInRank !== null
                        ? <p className="font-mono font-bold text-lg text-cyan-300">{editingRow.computedDaysInRank} <span className="text-xs font-normal text-muted-foreground">days</span></p>
                        : <p className="text-muted-foreground text-sm">No promotion date set</p>}
                  </div>
                  <div className="bg-background/50 border border-border/50 rounded-md px-3 py-2.5">
                    <p className="font-mono text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1">
                      Duty Time in Rank <Zap className="w-2.5 h-2.5 text-cyan-400" />
                    </p>
                    {isLifetime
                      ? <p className="text-amber-300 font-bold text-sm font-mono">Lifetime</p>
                      : editingRow.computedDutyTime !== null
                        ? <p className="font-mono font-bold text-lg text-cyan-300">{editingRow.computedDutyTime} <span className="text-xs font-normal text-muted-foreground">HH:MM</span></p>
                        : editingRow.linkedMemberId
                          ? <p className="text-muted-foreground text-sm">No duty logs found</p>
                          : <p className="text-yellow-500/70 text-xs">Not linked to Personnel</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ─ Status ─ */}
            <div>
              <SectionHeader label="Status" />
              <div>
                <FieldLabel>Qualification Status</FieldLabel>
                <Select value={form.status || "__none__"} onValueChange={v => setField("status", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {STATUS_OPTIONS.filter(Boolean).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ─ Vote by High Command ─ */}
            <div>
              <SectionHeader label="Vote by High Command" />
              <FieldLabel>
                Select HC members who voted{" "}
                <span className="normal-case text-primary/60">(only High Command rank)</span>
              </FieldLabel>
              <HCVoterSelect
                voters={voters}
                onChange={setVoters}
                hcMembers={hcMembers}
              />
              {voters.length > 0 && (
                <p className="text-xs text-green-400/70 mt-1.5">
                  {voters.length} HC member{voters.length > 1 ? "s" : ""} voted
                </p>
              )}
            </div>

            {/* ─ Notes ─ */}
            <div>
              <SectionHeader label="Notes" />
              <Textarea
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
                className="bg-background min-h-[70px]"
                placeholder="Command notes, remarks..."
              />
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Days & Duty Time are auto-calculated from promotion date + duty logs.
              </p>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="font-mono uppercase tracking-wider text-xs"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rank Requirements Modal ── */}
      <Dialog open={rankModalOpen} onOpenChange={setRankModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border-border/50 text-foreground">
          <DialogHeader>
            <DialogTitle className="uppercase font-bold tracking-wider text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              Rank Requirements
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Setting requirements for{" "}
                <span className={`font-bold ${rankColor[rankModalRank] ?? "text-foreground"}`}>
                  {rankModalRank}
                </span>
                {" "}— will apply to <span className="text-foreground font-semibold">all members</span> of this rank.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Min Seniority</FieldLabel>
                <Input
                  value={rankMinSeniority}
                  onChange={e => setRankMinSeniority(e.target.value)}
                  className="bg-background font-mono text-xs"
                  placeholder="e.g. 63(9 Weeks)"
                  autoFocus
                />
              </div>
              <div>
                <FieldLabel>Min Duty Hours</FieldLabel>
                <Input
                  value={rankMinDuty}
                  onChange={e => setRankMinDuty(e.target.value)}
                  className="bg-background font-mono text-xs"
                  placeholder="e.g. 120"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRankModalOpen(false)}
                className="font-mono text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRankSave}
                disabled={rankSaving}
                className="font-mono uppercase tracking-wider text-xs"
              >
                {rankSaving ? "Saving..." : "Apply to All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
