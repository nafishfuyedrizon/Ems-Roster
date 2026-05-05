import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Clock, Save, RotateCcw, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";

const SHIFT_META: Record<string, { emoji: string; color: string; border: string; defaultDesc: string }> = {
  Evening:  { emoji: "🌆", color: "text-indigo-400",  border: "border-indigo-500/30",  defaultDesc: "Early evening shift" },
  Night:    { emoji: "🌙", color: "text-violet-400",  border: "border-violet-500/30",  defaultDesc: "Late night shift" },
  Midnight: { emoji: "🌃", color: "text-blue-400",    border: "border-blue-500/30",    defaultDesc: "Midnight shift" },
};

function toHHMM(hour: number): string {
  const h = hour % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${suffix}`;
}

function HourSelect({ value, onChange, label, includeEndOfDay = false }: { value: number; onChange: (v: number) => void; label: string; includeEndOfDay?: boolean }) {
  const hours = Array.from({ length: includeEndOfDay ? 25 : 24 }, (_, i) => i);
  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{label}</label>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
        style={{ backgroundColor: "#0f1117", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {hours.map((i) => (
          <option key={i} value={i} style={{ backgroundColor: "#1e2230", color: "#e2e8f0" }}>
            {toHHMM(i)} ({String(i).padStart(2, "0")}:00)
          </option>
        ))}
      </select>
    </div>
  );
}

interface ShiftCfg { shiftName: string; displayName: string | null; startHour: number; endHour: number }

function getDisplayName(cfg: ShiftCfg) {
  return cfg.displayName && cfg.displayName.trim() ? cfg.displayName : cfg.shiftName;
}

export default function AdminShiftConfig() {
  const [configs, setConfigs]   = useState<ShiftCfg[]>([]);
  const [original, setOriginal] = useState<ShiftCfg[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/shift-config`);
      const data: ShiftCfg[] = await res.json();
      setConfigs(data);
      setOriginal(JSON.parse(JSON.stringify(data)));
    } catch {
      setError("Failed to load shift config.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateHour = (name: string, field: "startHour" | "endHour", val: number) => {
    setConfigs(prev => prev.map(c => c.shiftName === name ? { ...c, [field]: val } : c));
  };

  const updateDisplayName = (name: string, val: string) => {
    setConfigs(prev => prev.map(c => c.shiftName === name ? { ...c, displayName: val } : c));
  };

  const save = async (name: string) => {
    const cfg = configs.find(c => c.shiftName === name);
    if (!cfg) return;
    setSaving(name);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/shift-config/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startHour: cfg.startHour,
          endHour: cfg.endHour,
          displayName: cfg.displayName ?? cfg.shiftName,
        }),
      });
      if (!res.ok) throw new Error();
      setOriginal(prev => prev.map(c => c.shiftName === name ? { ...cfg } : c));
      setEditingName(null);
      setSaved(name);
      setTimeout(() => setSaved(null), 2500);
    } catch {
      setError(`Failed to save ${name} shift config.`);
    } finally {
      setSaving(null);
    }
  };

  const reset = (name: string) => {
    const orig = original.find(c => c.shiftName === name);
    if (!orig) return;
    setConfigs(prev => prev.map(c => c.shiftName === name ? { ...orig } : c));
    setEditingName(null);
  };

  const isDirty = (name: string) => {
    const cur  = configs.find(c => c.shiftName === name);
    const orig = original.find(c => c.shiftName === name);
    if (!cur || !orig) return false;
    return (
      cur.startHour   !== orig.startHour   ||
      cur.endHour     !== orig.endHour     ||
      (cur.displayName ?? "") !== (orig.displayName ?? "")
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
    </div>
  );

  const ORDER = ["Evening", "Night", "Midnight"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-bold uppercase tracking-widest text-sm text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Shift Time Configuration
        </h3>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Customize shift names, start and end hours. The Discord bot uses these settings to classify duty logs automatically.
        </p>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/8 text-xs text-red-400 font-mono">
          {error}
        </div>
      )}

      {/* Shift cards */}
      <div className="space-y-3">
        {ORDER.map(name => {
          const cfg  = configs.find(c => c.shiftName === name);
          const meta = SHIFT_META[name];
          if (!cfg || !meta) return null;
          const dirty    = isDirty(name);
          const isSaving = saving === name;
          const isSaved  = saved  === name;
          const isEditing = editingName === name;
          const displayedName = getDisplayName(cfg);

          return (
            <div key={name} className={cn(
              "rounded-xl border p-4 space-y-4 transition-all",
              dirty ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/40",
            )}>

              {/* Shift label row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="text-2xl shrink-0">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          value={cfg.displayName ?? cfg.shiftName}
                          onChange={e => updateDisplayName(name, e.target.value)}
                          onBlur={() => { if (!isDirty(name)) setEditingName(null); }}
                          onKeyDown={e => { if (e.key === "Escape") reset(name); }}
                          maxLength={30}
                          placeholder={cfg.shiftName}
                          className="h-8 text-sm font-bold bg-background/60 border-primary/30 focus:border-primary/60 max-w-[200px]"
                        />
                        <span className="text-[10px] text-muted-foreground/40 font-mono">
                          (internal: {name})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <p className={cn("font-bold text-sm uppercase tracking-widest truncate", meta.color)}>
                          {displayedName}
                        </p>
                        <button
                          onClick={() => setEditingName(name)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-primary"
                          title="Edit shift name"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {!isEditing && cfg.displayName && cfg.displayName !== cfg.shiftName && (
                      <p className="text-[10px] font-mono text-muted-foreground/40">internal: {name}</p>
                    )}
                  </div>
                </div>

                {/* Time preview badge */}
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-semibold shrink-0",
                  meta.border, meta.color,
                  dirty ? "bg-primary/10" : "bg-muted/10"
                )}>
                  <Clock className="w-3 h-3" />
                  {toHHMM(cfg.startHour)} — {toHHMM(cfg.endHour)}
                  {dirty && <span className="text-yellow-400 ml-1">●</span>}
                </div>
              </div>

              {/* Name edit hint when not editing */}
              {!isEditing && (
                <button
                  onClick={() => setEditingName(name)}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-primary/70 font-mono transition-colors group"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Click to rename shift</span>
                </button>
              )}

              {/* Hour selectors */}
              <div className="flex gap-3">
                <HourSelect label="Start Hour" value={cfg.startHour} onChange={v => updateHour(name, "startHour", v)} />
                <HourSelect label="End Hour"   value={cfg.endHour}   onChange={v => updateHour(name, "endHour",   v)} includeEndOfDay />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 justify-end">
                {dirty && (
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => reset(name)}
                    className="h-8 text-xs font-mono text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => save(name)}
                  disabled={isSaving || !dirty}
                  className={cn(
                    "h-8 text-xs font-mono gap-1.5 min-w-[90px]",
                    isSaved ? "bg-emerald-600 hover:bg-emerald-600" : ""
                  )}
                >
                  {isSaving ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                  ) : isSaved ? (
                    <><CheckCircle2 className="w-3 h-3" /> Saved!</>
                  ) : (
                    <><Save className="w-3 h-3" /> Save</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Shift note */}
      <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 px-4 py-3 flex items-start gap-3">
        <span className="text-xl shrink-0">🔥</span>
        <div>
          <p className="font-bold text-sm text-orange-400 uppercase tracking-widest">Full Shift</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Full Shift is automatically assigned to any duty session that doesn't match Evening, Night, or Midnight time windows. No manual configuration needed.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/25 bg-muted/10 px-4 py-3 text-xs text-muted-foreground font-mono">
        <span className="text-yellow-400 font-semibold">⚠ Note:</span> Renaming a shift changes the display label only. The internal type (Evening/Night/Midnight) in duty logs remains unchanged.
      </div>
    </div>
  );
}
