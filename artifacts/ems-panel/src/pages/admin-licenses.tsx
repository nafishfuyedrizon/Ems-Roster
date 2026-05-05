import { useState } from "react";
import { useListLicenses, getListLicensesQueryKey, useCreateLicense, useDeleteLicense } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Key, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminLicenses() {
  const { data: licenses, isLoading } = useListLicenses();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [discordLogs, setDiscordLogs] = useState("");
  const [parsing, setParsing] = useState(false);

  const createMutation = useCreateLicense();
  const deleteMutation = useDeleteLicense();

  const handleParse = () => {
    if (!discordLogs.trim()) return;
    setParsing(true);
    
    try {
      // Basic parser logic for "[Name] [License] went on/off-duty. (Rank)"
      const lines = discordLogs.split('\n');
      const parsedData = new Map<string, { onDuty: number, offDuty: number, name: string }>();
      
      let matchCount = 0;

      for (const line of lines) {
        const match = line.match(/\[(.*?)\]\s+\[(.*?)\]\s+went\s+(on|off)-duty/i);
        if (match) {
          const [, name, licenseKey, action] = match;
          const key = licenseKey.trim();
          
          if (!parsedData.has(key)) {
            parsedData.set(key, { onDuty: 0, offDuty: 0, name: name.trim() });
          }
          
          const record = parsedData.get(key)!;
          if (action.toLowerCase() === 'on') record.onDuty++;
          else if (action.toLowerCase() === 'off') record.offDuty++;
          
          matchCount++;
        }
      }

      // In a real app, this would be a bulk mutation, but we'll do it sequentially for the mock
      if (parsedData.size > 0) {
        let completed = 0;
        parsedData.forEach((data, key) => {
          createMutation.mutate({ 
            data: {
              licenseKey: key,
              onDutyCount: data.onDuty,
              offDutyCount: data.offDuty,
              lastSeen: new Date().toISOString()
            }
          }, {
            onSettled: () => {
              completed++;
              if (completed === parsedData.size) {
                queryClient.invalidateQueries({ queryKey: getListLicensesQueryKey() });
                toast({ title: `Parsed ${matchCount} events across ${parsedData.size} unique licenses.` });
                setDiscordLogs("");
                setParsing(false);
              }
            }
          });
        });
      } else {
        toast({ title: "No valid logs found in format.", variant: "destructive" });
        setParsing(false);
      }
    } catch (e) {
      toast({ title: "Error parsing logs.", variant: "destructive" });
      setParsing(false);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this license record?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLicensesQueryKey() });
          toast({ title: "License record deleted." });
        },
        onError: () => toast({ title: "Failed to delete record.", variant: "destructive" })
      });
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" /> Discord Log Parser
            </CardTitle>
            <CardDescription className="text-xs font-mono">Format: [Name] [License] went on/off-duty. (Rank)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="Paste raw discord channel logs here..." 
              className="min-h-[250px] font-mono text-xs bg-background/50 resize-none border-border/50 focus-visible:ring-primary/50"
              value={discordLogs}
              onChange={(e) => setDiscordLogs(e.target.value)}
            />
            <Button 
              className="w-full font-mono uppercase tracking-wider text-xs" 
              onClick={handleParse}
              disabled={parsing || !discordLogs.trim()}
            >
              {parsing ? 'Processing...' : 'Parse & Update Records'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <div className="border border-border/50 rounded-md overflow-hidden bg-background/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 bg-muted/30">
                <TableHead className="font-mono text-xs uppercase text-muted-foreground w-10">
                  <Key className="w-4 h-4" />
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground">License Key</TableHead>
                <TableHead className="font-mono text-xs uppercase text-muted-foreground">Last Known Name</TableHead>
                <TableHead className="text-center font-mono text-xs uppercase text-muted-foreground">On-Duty</TableHead>
                <TableHead className="text-center font-mono text-xs uppercase text-muted-foreground">Off-Duty</TableHead>
                <TableHead className="text-right font-mono text-xs uppercase text-muted-foreground w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : licenses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No license records found.</TableCell>
                </TableRow>
              ) : (
                licenses?.map(license => (
                  <TableRow key={license.id} className="border-border/50 hover:bg-muted/20">
                    <TableCell className="text-muted-foreground"><Key className="w-3 h-3" /></TableCell>
                    <TableCell className="font-mono text-xs text-primary">{license.licenseKey}</TableCell>
                    <TableCell className="text-sm">{license.memberName || 'Unknown'}</TableCell>
                    <TableCell className="text-center font-mono text-sm text-green-500">{license.onDutyCount}</TableCell>
                    <TableCell className="text-center font-mono text-sm text-red-500">{license.offDutyCount}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(license.id)} disabled={deleteMutation.isPending} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
