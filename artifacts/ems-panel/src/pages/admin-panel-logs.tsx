import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { API_BASE } from "@/lib/api-base";

interface PanelLog {
  id: number;
  action: string;
  targetName: string;
  details: string;
  performedBy: string;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  MEMBER_CREATED:   { label: "Member Created",    color: "bg-green-500/20 text-green-400 border-green-500/30" },
  MEMBER_UPDATED:   { label: "Member Updated",    color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  MEMBER_DELETED:   { label: "Member Deleted",    color: "bg-red-500/20 text-red-400 border-red-500/30" },
  DUTY_LOG_CREATED: { label: "Duty Log Added",    color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  DUTY_LOG_UPDATED: { label: "Duty Log Updated",  color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  DUTY_LOG_DELETED:    { label: "Duty Log Deleted",  color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  STAFF_ROLES_UPDATED: { label: "Staff Roles",       color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

export default function AdminPanelLogs() {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");

  const { data: logs, isLoading, refetch, isFetching } = useQuery<PanelLog[]>({
    queryKey: ["panel-logs"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/panel-logs?limit=500`);
      if (!res.ok) throw new Error("Failed to fetch panel logs");
      const data: PanelLog[] = await res.json();
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    staleTime: 30_000,
  });

  const filtered = (logs ?? []).filter(log => {
    const matchesAction = filterAction === "ALL" || log.action === filterAction;
    const q = search.toLowerCase();
    const matchesSearch = !q || log.targetName.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
    return matchesAction && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or details..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 bg-background font-mono text-sm"
          />
        </div>

        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px] bg-background font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="font-mono text-sm">All Actions</SelectItem>
            {Object.entries(ACTION_META).map(([key, { label }]) => (
              <SelectItem key={key} value={key} className="font-mono text-sm">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0"
          title="Refresh logs"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground font-mono">
        {isLoading ? "Loading..." : `${filtered.length} entries`}
      </div>

      <div className="border border-border/50 rounded-md overflow-hidden bg-background/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 bg-muted/30">
              <TableHead className="font-mono text-xs uppercase text-muted-foreground w-40">Timestamp</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground w-36">Action</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground w-32">By</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Target</TableHead>
              <TableHead className="font-mono text-xs uppercase text-muted-foreground">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground font-mono text-sm">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(log => {
                const meta = ACTION_META[log.action] ?? { label: log.action, color: "bg-muted text-muted-foreground border-border" };
                const ts = new Date(log.createdAt);
                return (
                  <TableRow key={log.id} className="border-border/50 hover:bg-muted/20">
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      <div>{ts.toLocaleDateString()}</div>
                      <div className="text-[10px] opacity-70">{ts.toLocaleTimeString()}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-mono ${meta.color}`}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-yellow-400/80 font-medium whitespace-nowrap">
                      {log.performedBy || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-primary font-medium">
                      {log.targetName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.details}
                    </TableCell>
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
