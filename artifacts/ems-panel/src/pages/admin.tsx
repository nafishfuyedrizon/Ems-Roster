import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAccessValidator } from "@/hooks/use-access-validator";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, Loader2, KeyRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminMembers from "./admin-members";
import AdminDutyLogs from "./admin-duty-logs";
import AdminPanelLogs from "./admin-panel-logs";
import AdminStaffRoles from "./admin-staff-roles";
import AdminShiftConfig from "./admin-shift-config";
import AdminQualification from "./admin-qualification";
import AdminExEms from "./admin-ex-ems";
import AdminHcFtb from "./admin-hc-ftb";
import AdminDoctorAccounts from "./admin-doctor-accounts";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export default function AdminPanel() {
  const { isAuthenticated, adminIdentity, adminRole, authSource, loginWithMasterPassword, loginWithDiscord, logout } = useAuth();
  const [masterKey, setMasterKey] = useState("");
  const [error, setError] = useState("");
  const [discordLoading, setDiscordLoading] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);

  const isHighCommand = adminRole === "high-command";
  const isFtpEms = adminRole === "ftp-ems";
  const isFtbQC = adminRole === "ftb-qc";
  const isFull = !isHighCommand && !isFtpEms && !isFtbQC;
  const isMasterKeySession = authSource === "master-key";

  useAccessValidator({
    isAuthenticated,
    adminIdentity,
    onRevoked: logout,
  });

  const handleDiscordLogin = async () => {
    setDiscordLoading(true);
    setError("");
    const result = await loginWithDiscord();
    setDiscordLoading(false);
    if (!result.success) {
      setError(result.error ?? "Discord authentication failed.");
    }
  };

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMasterLoading(true);
    setError("");
    const result = await loginWithMasterPassword(masterKey);
    setMasterLoading(false);
    if (!result.success) {
      setError(result.error ?? "Invalid master key.");
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-border/50 shadow-xl shadow-black/50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-14 h-14 bg-primary/10 flex items-center justify-center rounded-full border border-primary/20 mb-4">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="uppercase tracking-wider text-xl">Restricted Access</CardTitle>
              <CardDescription className="font-mono text-xs">Command level authorization required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-destructive text-xs font-mono text-center bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                onClick={handleDiscordLogin}
                disabled={discordLoading}
                className="w-full h-12 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold uppercase tracking-widest font-mono border-0 gap-3"
              >
                {discordLoading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <DiscordIcon className="w-5 h-5" />
                }
                {discordLoading ? "Authorizing..." : "Login with Discord"}
              </Button>

              <p className="text-muted-foreground text-[11px] font-mono text-center">
                Login using your Discord account linked to your EMS profile
              </p>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground font-mono uppercase tracking-widest">or</span>
                </div>
              </div>

              <form onSubmit={handleMasterLogin} className="space-y-3">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Master key..."
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    className="font-mono pl-9 bg-background/50 border-border/50 text-center"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={masterLoading || !masterKey}
                  variant="outline"
                  className="w-full uppercase tracking-widest font-mono font-bold border-border/50 text-muted-foreground hover:text-foreground"
                >
                  {masterLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {masterLoading ? "Verifying..." : "Master Key Login"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight uppercase text-destructive sm:text-3xl">
              <ShieldAlert className="w-8 h-8" /> Admin Command
            </h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              {isHighCommand ? "High Command Access" : isFtpEms ? "FTP EMS Access" : isFtbQC ? "FTB · QC Access" : "System Management Console"}
              {adminIdentity && (
                <span className="ml-2 text-primary font-semibold">— {adminIdentity}</span>
              )}
            </p>
          </div>
          
          <Button variant="outline" onClick={logout} className="w-full font-mono text-xs sm:w-auto">
            Terminate Session
          </Button>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 rounded-lg overflow-hidden">
          <Tabs defaultValue={isFtbQC ? "qual-chart" : "members"} className="w-full">
            <div className="overflow-x-auto border-b border-border/50 bg-muted/20 px-4">
              <TabsList className="flex h-auto min-w-max justify-start gap-2 bg-transparent py-2">
                {(isFull || isFtpEms || isHighCommand) && (
                  <TabsTrigger value="members" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono uppercase text-xs h-9">
                    EMS
                  </TabsTrigger>
                )}
                {(isFull || isHighCommand || isFtpEms) && (
                  <TabsTrigger value="duty-logs" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono uppercase text-xs h-9">
                    Duty Logs
                  </TabsTrigger>
                )}
                {(isFull || isHighCommand) && (
                  <TabsTrigger value="panel-logs" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono uppercase text-xs h-9">
                    Panel Logs
                  </TabsTrigger>
                )}
                {(isFull || isHighCommand) && (
                  <TabsTrigger value="staff-roles" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono uppercase text-xs h-9">
                    Staff Roles
                  </TabsTrigger>
                )}
                {(isFull || isHighCommand) && (
                  <TabsTrigger value="shift-config" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono uppercase text-xs h-9">
                    Shift Times
                  </TabsTrigger>
                )}
                {(isFull || isHighCommand || isFtbQC) && (
                  <TabsTrigger value="qual-chart" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono uppercase text-xs h-9">
                    Qual Chart
                  </TabsTrigger>
                )}
                {(isFull || isHighCommand) && (
                  <TabsTrigger value="ex-ems" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400 font-mono uppercase text-xs h-9">
                    Ex EMS
                  </TabsTrigger>
                )}
                {isMasterKeySession && (
                  <TabsTrigger value="doctor-accounts" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-300 font-mono uppercase text-xs h-9">
                    Doctor Accounts
                  </TabsTrigger>
                )}
                {(isFull || isHighCommand) && (
                  <TabsTrigger value="hc-ftb" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 font-mono uppercase text-xs h-9">
                    Ex HC/FTB Chart
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
            
            <div className="p-4 sm:p-6">
              {(isFull || isFtpEms || isHighCommand) && (
                <TabsContent value="members" className="mt-0 outline-none">
                  <AdminMembers canRemove={isFull || isHighCommand} />
                </TabsContent>
              )}
              {(isFull || isHighCommand || isFtpEms) && (
                <TabsContent value="duty-logs" className="mt-0 outline-none">
                  <AdminDutyLogs readOnly={isFtpEms} />
                </TabsContent>
              )}
              {(isFull || isHighCommand) && (
                <TabsContent value="panel-logs" className="mt-0 outline-none">
                  <AdminPanelLogs />
                </TabsContent>
              )}
              {(isFull || isHighCommand) && (
                <TabsContent value="staff-roles" className="mt-0 outline-none">
                  <AdminStaffRoles adminRole={adminRole} />
                </TabsContent>
              )}
              {(isFull || isHighCommand) && (
                <TabsContent value="shift-config" className="mt-0 outline-none">
                  <AdminShiftConfig />
                </TabsContent>
              )}
              {(isFull || isHighCommand || isFtbQC) && (
                <TabsContent value="qual-chart" className="mt-0 outline-none">
                  <AdminQualification canEdit={isFull || isHighCommand || isFtbQC} />
                </TabsContent>
              )}
              {(isFull || isHighCommand) && (
                <TabsContent value="ex-ems" className="mt-0 outline-none">
                  <AdminExEms />
                </TabsContent>
              )}
              {isMasterKeySession && (
                <TabsContent value="doctor-accounts" className="mt-0 outline-none">
                  <AdminDoctorAccounts />
                </TabsContent>
              )}
              {(isFull || isHighCommand) && (
                <TabsContent value="hc-ftb" className="mt-0 outline-none">
                  <AdminHcFtb />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
}
