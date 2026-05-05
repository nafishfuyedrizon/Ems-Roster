import { useState, useMemo } from "react";
import { useListMembers, useCreateDutyLog, useUpdateDutyLog, useDeleteDutyLog, getListDutyLogsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Search, X, Clock, CalendarRange, Filter } from "lucide-react";
import { formatMinutes, WEEKS, SHIFT_LABELS } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const SHIFT_DURATIONS: Record<string, number> = {
  Evening: 120, Night: 120, Midnight: 120, Full: 480,
};

const SHIFT_OPTS: { key: "Evening" | "Night" | "Midnight" | "Full"; label: string; color: string; active: string }[] = [
  { key: "Evening",  label: "🌆 Evening",  color: "border-indigo-500/30 text-indigo-400",  active: "bg-indigo-500/15 border-indigo-500/50 text-indigo-300" },
  { key: "Night",    label: "🌙 Night",    color: "border-violet-500/30 text-violet-400",  active: "bg-violet-500/15 border-violet-500/50 text-violet-300" },
  { key: "Midnight", label: "🌃 Midnight", color: "border-blue-500/30 text-blue-400",      active: "bg-blue-500/15 border-blue-500/50 text-blue-300" },
  { key: "Full",     label: "🔥 Full",     color: "border-orange-500/30 text-orange-400",  active: "bg-orange-500/15 border-orange-500/50 text-orange-300" },
];

const dutyLogSchema = z.object({
  memberId: z.coerce.number().min(1, "Member is required"),
  weekStart: z.string().min(1, "Week is required"),
  shiftType: z.enum(["Evening", "Night", "Midnight", "Full"]),
  durationMinutes: z.coerce.number().min(0, "Duration is required"),
  logDate: z.string().min(1, "Date is required"),
  notes: z.string().optional().nullable(),
});
type DutyLogFormValues = z.infer<typeof dutyLogSchema>;

const BDT_OFFSET_MS = 6 * 60 * 60 * 1000;
function formatBdtDate(date: Date) {
  const bdt = new Date(date.getTime() + BDT_OFFSET_MS);
  return `${bdt.getUTCFullYear()}-${String(bdt.getUTCMonth() + 1).padStart(2, "0")}-${String(bdt.getUTCDate()).padStart(2, "0")}`;
}
function todayStr() { return formatBdtDate(new Date()); }
function firstOfMonth() {
  const d = new Date(Date.now() + BDT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function dateInputValue(value: string) {
  return value.includes("T") ? value.split("T")[0] : value.slice(0, 10);
}

export default function AdminDutyLogs({ readOnly = false }: { readOnly?: boolean }) {
  /* ── filters ── */
  const [nameSearch, setNameSearch]       = useState("");
  const [fromDate,   setFromDate]         = useState(firstOfMonth());
  const [toDate,     setToDate]           = useState(todayStr());
  const [shiftFilter, setShiftFilter]     = useState<Set<string>>(new Set());

  /* ── dialog ── */
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: members } = useListMembers();
  const queryClient        = useQueryClient();
  const { toast }          = useToast();

  /* ── fetch with date range ── */
  const [queryFromDate, queryToDate] = fromDate && toDate && fromDate > toDate
    ? [toDate, fromDate]
    : [fromDate, toDate];
  const params = new URLSearchParams();
  if (queryFromDate) params.set("fromDate", queryFromDate);
  if (queryToDate)   params.set("toDate", queryToDate);
  if (shiftFilter.size === 1) params.set("shiftType", [...shiftFilter][0]);

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["duty-logs-filtered", queryFromDate, queryToDate, [...shiftFilter].sort().join(",")],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/duty-logs?${params.toString()}`);
      return res.json() as Promise<any[]>;
    },
  });

  /* ── client-side filters ── */
  const filtered = useMemo(() => {
    if (!logs || !members) return [];
    return logs.filter(log => {
      const member = members.find(m => m.id === log.memberId);
      const nameMatch = !nameSearch.trim() ||
        member?.name?.toLowerCase().includes(nameSearch.toLowerCase()) ||
        member?.callSign?.toLowerCase().includes(nameSearch.toLowerCase());
      const shiftMatch = shiftFilter.size === 0 || shiftFilter.size === 1
        ? true
        : shiftFilter.has(log.shiftType);
      return nameMatch && shiftMatch;
    });
  }, [logs, members, nameSearch, shiftFilter]);

  /* ── totals ── */
  const totalSeconds = useMemo(() => filtered.reduce((s, l) => s + (l.durationMinutes ?? 0), 0), [filtered]);

  /* ── mutations ── */
  const createMutation = useCreateDutyLog();
  const updateMutation = useUpdateDutyLog();
  const deleteMutation = useDeleteDutyLog();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListDutyLogsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["duty-logs-filtered"] });
  };

  const form = useForm<DutyLogFormValues>({
    resolver: zodResolver(dutyLogSchema),
    defaultValues: { memberId: 0, weekStart: WEEKS[0].weekStart, shiftType: "Evening", durationMinutes: 120, logDate: todayStr(), notes: "" },
  });

  const handleOpenEdit = (log: any) => {
    setEditingId(log.id);
    form.reset({
      memberId: log.memberId, weekStart: log.weekStart, shiftType: log.shiftType,
      durationMinutes: Math.round(log.durationMinutes / 60),
      logDate: dateInputValue(log.logDate),
      notes: log.notes || "",
    });
    setDialogOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    form.reset({ memberId: 0, weekStart: WEEKS[0].weekStart, shiftType: "Evening", durationMinutes: 120, logDate: todayStr(), notes: "" });
    setDialogOpen(true);
  };

  const onSubmit = (data: DutyLogFormValues) => {
    const payload = { ...data, durationMinutes: data.durationMinutes * 60 };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { invalidate(); toast({ title: "Duty log updated." }); setDialogOpen(false); },
        onError: () => toast({ title: "Failed to update.", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { invalidate(); toast({ title: "Duty log created." }); setDialogOpen(false); },
        onError: () => toast({ title: "Failed to create.", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this log?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => { invalidate(); toast({ title: "Log deleted." }); },
        onError: () => toast({ title: "Failed to delete.", variant: "destructive" }),
      });
    }
  };

  const toggleShift = (key: string) => {
    setShiftFilter(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleFromDateChange = (value: string) => {
    setFromDate(value);
    if (toDate && value && value > toDate) setToDate(value);
  };
  const handleToDateChange = (value: string) => {
    setToDate(value);
    if (fromDate && value && value < fromDate) setFromDate(value);
  };

  const clearFilters = () => {
    setNameSearch(""); setFromDate(firstOfMonth()); setToDate(todayStr()); setShiftFilter(new Set());
  };
  const hasFilters = nameSearch || fromDate !== firstOfMonth() || toDate !== todayStr() || shiftFilter.size > 0;

  return (
    <div className="space-y-4">

      {/* ── FILTER BAR ── */}
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">

        {/* Row 1: Name search + date range */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Name Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 block mb-1.5">
              <Search className="w-3 h-3 inline mr-1" />Name / Call Sign
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
              <Input
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                placeholder="Search member..."
                className="pl-8 h-9 bg-background/60 font-mono text-sm border-border/40"
              />
              {nameSearch && (
                <button onClick={() => setNameSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* From Date */}
          <div className="min-w-[140px]">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 block mb-1.5">
              <CalendarRange className="w-3 h-3 inline mr-1" />From
            </label>
            <Input
              type="date" value={fromDate}
              onChange={e => handleFromDateChange(e.target.value)}
              className="h-9 bg-background/60 font-mono text-sm border-border/40"
            />
          </div>

          {/* To Date */}
          <div className="min-w-[140px]">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 block mb-1.5">To</label>
            <Input
              type="date" value={toDate}
              onChange={e => handleToDateChange(e.target.value)}
              className="h-9 bg-background/60 font-mono text-sm border-border/40"
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}
              className="h-9 text-xs font-mono text-muted-foreground gap-1.5 self-end">
              <X className="w-3 h-3" /> Reset
            </Button>
          )}
        </div>

        {/* Row 2: Shift filter toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1">
            <Filter className="w-3 h-3" />Shift
          </span>
          <button
            onClick={() => setShiftFilter(new Set())}
            className={cn(
              "px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold transition-all",
              shiftFilter.size === 0
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border/40 text-muted-foreground hover:border-border/70"
            )}
          >All</button>
          {SHIFT_OPTS.map(s => (
            <button
              key={s.key}
              onClick={() => toggleShift(s.key)}
              className={cn(
                "px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold transition-all",
                shiftFilter.has(s.key) ? s.active : `${s.color} hover:opacity-80`
              )}
            >{s.label}</button>
          ))}
        </div>

        {/* Row 3: Result summary */}
        <div className="flex items-center justify-between pt-1 border-t border-border/20">
          <span className="text-[11px] font-mono text-muted-foreground/60">
            Showing <span className="text-foreground font-semibold">{filtered.length}</span> logs
            {nameSearch && <> for "<span className="text-primary">{nameSearch}</span>"</>}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <Clock className="w-3 h-3 text-emerald-400" />
            <span className="text-muted-foreground">Total:</span>
            <span className="text-emerald-400 font-bold">{formatMinutes(totalSeconds)}</span>
          </div>
        </div>
      </div>

      {/* ── ACTION BAR ── */}
      <div className="flex items-center justify-between">
        {readOnly && (
          <span className="text-xs font-mono text-muted-foreground border border-border/40 rounded px-2 py-1">VIEW ONLY</span>
        )}
        <div className="ml-auto">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {!readOnly && (
              <DialogTrigger asChild>
                <Button onClick={handleOpenAdd} className="gap-2 font-mono uppercase tracking-wider text-xs">
                  <Plus className="w-4 h-4" /> Add Duty Log
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px] bg-card border-border/50 text-foreground">
              <DialogHeader>
                <DialogTitle className="uppercase font-bold tracking-wider">{editingId ? "Edit Duty Log" : "New Duty Log"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <FormField control={form.control} name="memberId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Personnel</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v, 10))} value={field.value ? field.value.toString() : ""} disabled={!!editingId}>
                        <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select member..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {members?.map(m => <SelectItem key={m.id} value={m.id.toString()}>[{m.callSign}] {m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="weekStart" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Week</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{WEEKS.map(w => <SelectItem key={w.weekStart} value={w.weekStart}>{w.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="logDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Date</FormLabel>
                        <FormControl><Input type="date" {...field} className="bg-background" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="shiftType" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Shift Type</FormLabel>
                        <Select onValueChange={(val: any) => { field.onChange(val); form.setValue("durationMinutes", SHIFT_DURATIONS[val] || 120); }} value={field.value}>
                          <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Evening">{SHIFT_LABELS.Evening}</SelectItem>
                            <SelectItem value="Night">{SHIFT_LABELS.Night}</SelectItem>
                            <SelectItem value="Midnight">{SHIFT_LABELS.Midnight}</SelectItem>
                            <SelectItem value="Full">{SHIFT_LABELS.Full}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Duration (Mins)</FormLabel>
                        <FormControl><Input type="number" {...field} className="bg-background font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-border/50">
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="font-mono uppercase tracking-wider text-xs">
                      {editingId ? "Save Changes" : "Record Log"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="border border-border/50 rounded-md overflow-hidden bg-background/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 bg-muted/30">
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Date</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Personnel</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Shift</TableHead>
              <TableHead className="text-right font-mono text-xs uppercase text-muted-foreground">Duration</TableHead>
              {!readOnly && <TableHead className="text-right font-mono text-xs uppercase text-muted-foreground w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                  {!readOnly && <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 4 : 5} className="text-center h-24 text-muted-foreground font-mono text-sm">
                  No duty logs match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(log => {
                const member = members?.find(m => m.id === log.memberId);
                return (
                  <TableRow key={log.id} className="border-border/50 hover:bg-muted/20">
                    <TableCell className="font-mono text-sm">{log.logDate}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary text-sm">[{member?.callSign || "?"}]</span>
                        <span className="font-medium text-sm">{member?.name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{SHIFT_LABELS[log.shiftType]}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-400">{formatMinutes(log.durationMinutes)}</TableCell>
                    {!readOnly && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(log)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(log.id)} disabled={deleteMutation.isPending} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
