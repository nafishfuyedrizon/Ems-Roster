import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListMembers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/api-base";
import { readApiError } from "@/lib/read-api-error";

export default function AdminDoctorAccounts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: members } = useListMembers();
  const { data } = useQuery<any[]>({
    queryKey: ["doctor-accounts-admin"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/doctor-accounts`);
      if (!response.ok) throw new Error(await readApiError(response, "Failed to load doctor accounts"));
      return response.json();
    },
  });

  const [memberId, setMemberId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});

  const reload = async () => queryClient.invalidateQueries({ queryKey: ["doctor-accounts-admin"] });

  const createAccount = async () => {
    try {
      await fetch(`${API_BASE}/doctor-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: Number(memberId), username, password }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response, "Failed to create account"));
      });
      toast({ title: "Doctor account created" });
      setMemberId("");
      setUsername("");
      setPassword("");
      await reload();
    } catch (error) {
      toast({ title: "Failed to create account", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/doctor-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Failed to update account"));
      await reload();
    } catch (error) {
      toast({ title: "Failed to update account", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  const resetPassword = async (id: number) => {
    try {
      await fetch(`${API_BASE}/doctor-accounts/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswords[id] }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response, "Failed to reset password"));
      });
      toast({ title: "Password reset successful" });
      setResetPasswords((prev) => ({ ...prev, [id]: "" }));
    } catch (error) {
      toast({ title: "Failed to reset password", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/50">
        <CardHeader><CardTitle>Create Doctor Account</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
            <SelectContent>
              {(members ?? []).map((member) => (
                <SelectItem key={member.id} value={String(member.id)}>
                  {member.callSign} · {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="doctor username" />
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="temporary password" />
          <div className="md:col-span-3">
            <Button onClick={() => void createAccount()} disabled={!memberId || !username || !password}>Create Doctor Account</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(data ?? []).map((account) => (
          <Card key={account.id} className="border-border/50 bg-card/50">
            <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px] md:items-center">
              <div>
                <p className="font-semibold">{account.callSign} · {account.name}</p>
                <p className="text-xs text-muted-foreground">@{account.username} · {account.rank}</p>
              </div>
              <Button variant={account.isActive ? "outline" : "default"} onClick={() => void toggleActive(account.id, !account.isActive)}>
                {account.isActive ? "Deactivate" : "Activate"}
              </Button>
              <div className="flex gap-2">
                <Input value={resetPasswords[account.id] ?? ""} onChange={(event) => setResetPasswords((prev) => ({ ...prev, [account.id]: event.target.value }))} type="password" placeholder="new password" />
                <Button variant="outline" onClick={() => void resetPassword(account.id)}>Reset</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
