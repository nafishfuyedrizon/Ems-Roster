import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";

export default function DoctorLogin() {
  const { login } = useDoctorAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      setLocation("/doctor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/50 bg-card/60 shadow-2xl shadow-black/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl uppercase tracking-wider">Doctor Login</CardTitle>
          <CardDescription className="font-mono text-xs uppercase tracking-[0.28em]">Legacy BD EMS Medical Workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" className="font-mono" />
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="font-mono" />
            {error ? <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full font-mono uppercase tracking-widest" disabled={loading || !username || !password}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Signing In..." : "Enter Portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
