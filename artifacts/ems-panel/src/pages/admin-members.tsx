import { useState } from "react";
import { useListMembers, getListMembersQueryKey, useCreateMember, useDeleteMember } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, Search, UserMinus } from "lucide-react";
import { STATUS_COLORS, EMS_RANKS, RANK_COLORS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_BASE } from "@/lib/api-base";

const memberSchema = z.object({
  callSign: z.string().min(1, "Call sign is required"),
  name: z.string().min(1, "Name is required"),
  status: z.enum(["Active", "LOA", "Vacant", "Inactive"]),
  rank: z.string().min(1, "Rank is required"),
  discordId: z.string().optional().nullable(),
  discordUsername: z.string().optional().nullable(),
  licenseKey: z.string().optional().nullable(),
  joinedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  cid: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  lastPromotionDate: z.string().optional().nullable(),
  medTrex: z.enum(["Advance", "Trainee", "N/A"]).optional(),
  ftoMember: z.string().optional(),
  strike: z.enum(["N/A", "1/3", "2/3", "3/3"]).optional(),
  highCamNoted: z.string().optional().nullable(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

function RankBadge({ rank }: { rank: string | null | undefined }) {
  if (!rank) return <span className="text-muted-foreground/30 font-mono text-xs">—</span>;
  const c = RANK_COLORS[rank];
  if (!c) return <span className="font-mono text-xs text-muted-foreground">{rank}</span>;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono border",
      c.bg, c.text, c.border
    )}>
      {rank}
    </span>
  );
}

export default function AdminMembers({ canRemove = true }: { canRemove?: boolean }) {
  const { data: members, isLoading } = useListMembers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const createMutation = useCreateMember();
  const deleteMutation = useDeleteMember();

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: MemberFormValues & { email: string | null; strike: string } }) => {
      const r = await fetch(`${API_BASE}/members/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || "Failed to update member");
      }
      return r.json();
    },
  });

  const [convertTarget, setConvertTarget] = useState<any | null>(null);
  const [convertForm, setConvertForm] = useState({ exitStatus: "RESIGNED", exitDate: "" });

  const convertMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof convertForm }) => {
      const r = await fetch(`${API_BASE}/ex-ems/convert/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["ex-ems"] });
      toast({ title: `${convertTarget?.name} moved to Ex EMS` });
      setConvertTarget(null);
    },
    onError: () => toast({ title: "Conversion failed", variant: "destructive" }),
  });

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      callSign: "",
      name: "",
      status: "Active",
      rank: "",
      discordId: "",
      discordUsername: "",
      licenseKey: "",
      joinedAt: "",
      notes: "",
      cid: "",
      phone: "",
      email: "",
      lastPromotionDate: "",
      medTrex: "N/A",
      ftoMember: "N/A",
      strike: "N/A",
      highCamNoted: "N/A",
    },
  });

  const filteredMembers = members?.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.callSign.toLowerCase().includes(search.toLowerCase()) ||
    m.rank.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    const ai = EMS_RANKS.indexOf(a.rank ?? "");
    const bi = EMS_RANKS.indexOf(b.rank ?? "");
    const ar = ai === -1 ? EMS_RANKS.length : ai;
    const br = bi === -1 ? EMS_RANKS.length : bi;
    return ar !== br ? ar - br : a.name.localeCompare(b.name);
  });

  const handleOpenEdit = (member: any) => {
    setEditingId(member.id);
    form.reset({
      callSign: member.callSign,
      name: member.name,
      status: member.status,
      rank: member.rank,
      discordId: member.discordId || "",
      discordUsername: member.discordUsername || "",
      licenseKey: member.licenseKey || "",
      joinedAt: member.joinedAt ? member.joinedAt.split('T')[0] : "",
      notes: member.notes || "",
      cid: member.cid || "",
      phone: member.phone || "",
      email: member.email || "",
      lastPromotionDate: member.lastPromotionDate ? member.lastPromotionDate.split('T')[0] : "",
      medTrex: (member.medTrex as any) || "N/A",
      ftoMember: (member.ftoMember as string) || "N/A",
      strike: (member.strike as any) || "N/A",
      highCamNoted: member.highCamNoted || "N/A",
    });
    setDialogOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    form.reset({
      callSign: "",
      name: "",
      status: "Active",
      rank: "",
      discordId: "",
      discordUsername: "",
      licenseKey: "",
      joinedAt: new Date().toISOString().split('T')[0],
      notes: "",
      cid: "",
      phone: "",
      email: "",
      lastPromotionDate: "",
      medTrex: "N/A",
      ftoMember: "N/A",
      strike: "N/A",
      highCamNoted: "N/A",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: MemberFormValues) => {
    const payload = {
      ...data,
      email: data.email || null,
      strike: data.strike ?? "N/A",
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          toast({ title: "Member updated successfully." });
          setDialogOpen(false);
        },
        onError: () => toast({ title: "Failed to update member.", variant: "destructive" })
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          toast({ title: "Member created successfully." });
          setDialogOpen(false);
        },
        onError: () => toast({ title: "Failed to create member.", variant: "destructive" })
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this member? This action cannot be undone.")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          toast({ title: "Member deleted." });
        },
        onError: () => toast({ title: "Failed to delete member.", variant: "destructive" })
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search personnel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAdd} className="gap-2 font-mono uppercase tracking-wider text-xs">
              <Plus className="w-4 h-4" /> Add EMS
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[680px] bg-card border-border/50 text-foreground max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="uppercase font-bold tracking-wider">{editingId ? 'Edit Personnel Record' : 'New Personnel Record'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">

                {/* Section: Identity */}
                <div>
                  <p className="text-xs font-mono uppercase text-primary/70 tracking-widest mb-3 border-b border-border/30 pb-1">Identity</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="callSign" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Call Sign</FormLabel>
                        <FormControl><Input {...field} className="bg-background font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Character Name</FormLabel>
                        <FormControl><Input {...field} className="bg-background" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cid" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">CID</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} className="bg-background font-mono" placeholder="e.g. 12345" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Phone</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} className="bg-background font-mono" placeholder="e.g. 555-1234" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">E-Mail</FormLabel>
                        <FormControl><Input type="email" {...field} value={field.value || ""} className="bg-background font-mono" placeholder="user@example.com" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section: Position */}
                <div>
                  <p className="text-xs font-mono uppercase text-primary/70 tracking-widest mb-3 border-b border-border/30 pb-1">Position</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="rank" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Rank</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select rank..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EMS_RANKS.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="LOA">LOA</SelectItem>
                            <SelectItem value="Vacant">Vacant</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="joinedAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Date Joined</FormLabel>
                        <FormControl><Input type="date" {...field} value={field.value || ""} className="bg-background font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lastPromotionDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Last Promotion</FormLabel>
                        <FormControl><Input type="date" {...field} value={field.value || ""} className="bg-background font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section: Credentials */}
                <div>
                  <p className="text-xs font-mono uppercase text-primary/70 tracking-widest mb-3 border-b border-border/30 pb-1">Credentials</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="discordUsername" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Discord Username</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. nafish_07" className="bg-background font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="discordId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Discord ID</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. 1286283853186596904" className="bg-background font-mono" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="licenseKey" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">FiveM License Key <span className="text-primary/60 normal-case">(hex from #ems-timestamp)</span></FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} placeholder="a089c05e82a8e92d57c63c5ad1655ae..." className="bg-background font-mono text-xs" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section: Flags */}
                <div>
                  <p className="text-xs font-mono uppercase text-primary/70 tracking-widest mb-3 border-b border-border/30 pb-1">Flags & Discipline</p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="medTrex" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">MedEvac</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "N/A"}>
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="N/A">N/A</SelectItem>
                            <SelectItem value="Trainee">Trainee</SelectItem>
                            <SelectItem value="Advance">Advance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="strike" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Strike</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "N/A"}>
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="N/A">N/A</SelectItem>
                            <SelectItem value="1/3">1/3</SelectItem>
                            <SelectItem value="2/3">2/3</SelectItem>
                            <SelectItem value="3/3">3/3</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="ftoMember" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">FTP Member</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "N/A"}>
                          <FormControl>
                            <SelectTrigger className="bg-background font-mono">
                              <SelectValue placeholder="Select FTP rank" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="N/A">N/A</SelectItem>
                            <SelectItem value="FTP Supervisor">FTP Supervisor</SelectItem>
                            <SelectItem value="FTP Trainer">FTP Trainer</SelectItem>
                            <SelectItem value="FTP Advanced">FTP Advanced</SelectItem>
                            <SelectItem value="FTP Recruit">FTP Recruit</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="highCamNoted" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">High-Command</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "N/A"}>
                          <FormControl>
                            <SelectTrigger className="bg-background font-mono">
                              <SelectValue placeholder="Select HC status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="N/A">N/A</SelectItem>
                            <SelectItem value="✔ High-Command">✔ High-Command</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-mono uppercase text-primary/70 tracking-widest mb-3 border-b border-border/30 pb-1">Command Notes</p>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormControl><Textarea {...field} value={field.value || ""} className="bg-background min-h-[80px]" placeholder="Internal command notes..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="font-mono uppercase tracking-wider text-xs">
                    {editingId ? 'Save Changes' : 'Create Record'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border/50 rounded-md overflow-hidden bg-background/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 bg-muted/30">
              <TableHead className="font-mono text-xs uppercase text-muted-foreground w-20">ID</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground w-24">CS</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Name</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Rank</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">CID</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground text-center">MedEvac</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground text-center">Strike</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground text-center">FTP</TableHead>
              <TableHead className="text-right font-mono text-xs uppercase text-muted-foreground w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-12" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredMembers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center h-24 text-muted-foreground">No personnel records found.</TableCell>
              </TableRow>
            ) : (
              filteredMembers?.map(member => (
                <TableRow key={member.id} className="border-border/50 hover:bg-muted/20">
                  <TableCell className="font-mono text-xs text-muted-foreground">{member.id}</TableCell>
                  <TableCell className="font-mono font-medium text-primary">{member.callSign}</TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell><RankBadge rank={member.rank} /></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[member.status] || ""}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{member.cid || <span className="opacity-30">—</span>}</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {!member.medTrex || member.medTrex === "N/A"
                      ? <span className="opacity-30">N/A</span>
                      : <span className={member.medTrex === "Advance" ? "text-green-400" : "text-amber-400"}>{member.medTrex}</span>
                    }
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {!member.strike || member.strike === "N/A"
                      ? <span className="opacity-30">N/A</span>
                      : <span className={member.strike === "3/3" ? "text-red-400 font-bold" : "text-amber-400"}>{member.strike}</span>
                    }
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{member.ftoMember && member.ftoMember !== "N/A" ? <span className="text-teal-400">{member.ftoMember as string}</span> : <span className="opacity-30">—</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(member)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canRemove && (
                        <>
                          <Button variant="ghost" size="icon" title="Make Ex EMS"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                            onClick={() => { setConvertTarget(member); setConvertForm({ exitStatus: "RESIGNED", exitDate: "" }); }}>
                            <UserMinus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(member.id)} disabled={deleteMutation.isPending} className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Convert to Ex EMS Dialog */}
      <Dialog open={!!convertTarget} onOpenChange={v => { if (!v) setConvertTarget(null); }}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="uppercase text-sm font-bold text-amber-400 flex items-center gap-2">
              <UserMinus className="w-4 h-4" /> Make Ex EMS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Moving <span className="text-foreground font-semibold">{convertTarget?.name}</span> ({convertTarget?.callSign} · {convertTarget?.rank}) to Ex EMS.
              <br/>
              <span className="text-xs text-amber-400/80">This will remove them from EMS roster and Qual Chart automatically.</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Exit Status</label>
                <select
                  className="mt-1 w-full h-8 rounded-md border border-input px-2 text-xs font-mono"
                  style={{ backgroundColor: "#0f1117", color: "#e2e8f0" }}
                  value={convertForm.exitStatus}
                  onChange={e => setConvertForm(f => ({ ...f, exitStatus: e.target.value }))}
                >
                  {["RESIGNED", "FIRED", "REMOVED", "Terminated"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Exit Date</label>
                <Input
                  className="mt-1 h-8 text-xs font-mono"
                  placeholder="5-Apr-2025"
                  value={convertForm.exitDate}
                  onChange={e => setConvertForm(f => ({ ...f, exitDate: e.target.value }))}
                />
              </div>
            </div>
            {convertTarget && (() => {
              const hc  = convertTarget.highCamNoted === "✔ High-Command";
              const sup = convertTarget.medTrex === "Advance" || convertTarget.ftoMember === "FTP Supervisor";
              const adv = convertTarget.ftoMember === "FTP Advanced";
              const trn = convertTarget.medTrex === "Trainee" || convertTarget.ftoMember === "FTP Trainer";
              const rec = convertTarget.ftoMember === "FTP Recruit";
              const hasAny = hc || sup || adv || trn || rec;
              return (
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
                    FTB Qualifications <span className="text-emerald-400/70">(auto-detected)</span>
                  </label>
                  {hasAny ? (
                    <div className="flex flex-wrap gap-1.5">
                      {hc  && <span className="px-2 py-1 rounded border text-[10px] font-mono bg-orange-500/10 border-orange-500/40 text-orange-400">✔ High Command</span>}
                      {sup && <span className="px-2 py-1 rounded border text-[10px] font-mono bg-cyan-500/10 border-cyan-500/40 text-cyan-400">✔ FTP Supervisor</span>}
                      {adv && <span className="px-2 py-1 rounded border text-[10px] font-mono bg-purple-500/10 border-purple-500/40 text-purple-400">✔ FTP Advanced</span>}
                      {trn && <span className="px-2 py-1 rounded border text-[10px] font-mono bg-yellow-500/10 border-yellow-500/40 text-yellow-400">✔ FTP Trainer</span>}
                      {rec && <span className="px-2 py-1 rounded border text-[10px] font-mono bg-blue-500/10 border-blue-500/40 text-blue-400">✔ FTP Recruit</span>}
                    </div>
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground/50 italic">No FTB qualifications detected — HC/FTB Chart will not be updated.</p>
                  )}
                </div>
              );
            })()}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setConvertTarget(null)}>Cancel</Button>
              <Button size="sm" className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                disabled={convertMutation.isPending}
                onClick={() => convertTarget && convertMutation.mutate({ id: convertTarget.id, data: convertForm })}>
                {convertMutation.isPending ? "Converting..." : "Confirm — Make Ex EMS"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
