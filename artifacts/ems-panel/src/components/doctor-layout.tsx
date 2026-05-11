import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CalendarDays, ChevronDown, ClipboardList, FileText, HeartPulse, Home, LogOut, Pill, ShieldCheck, Sparkles, UserRound, UserRoundSearch, WalletCards } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonnelDossierDialog } from "@/components/personnel-dossier-dialog";
import { cn } from "@/lib/utils";
import { useDoctorAuth } from "@/hooks/use-doctor-auth";
import emsLogo from "@/assets/ems-logo.webp";

const navItems = [
  { href: "/doctor", label: "Dashboard", icon: Home },
  { href: "/doctor/appointments", label: "Appointments", icon: ClipboardList },
  { href: "/doctor/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/doctor/patients", label: "Patients", icon: UserRoundSearch },
  { href: "/doctor/medical-records", label: "Medical Records", icon: HeartPulse },
  { href: "/doctor/mfc", label: "MFC", icon: ShieldCheck },
  { href: "/doctor/prescriptions", label: "Prescriptions", icon: FileText },
  { href: "/doctor/medicines", label: "Medicines", icon: Pill },
  { href: "/doctor/prices", label: "Prices", icon: WalletCards },
];

export function DoctorLayout({ children }: { children: React.ReactNode }) {
  const { doctor, refresh, logout } = useDoctorAuth();
  const [location] = useLocation();
  const [profileOpenId, setProfileOpenId] = useState<number | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/doctor" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/15 to-cyan-400/10">
              <img src={emsLogo} alt="EMS logo" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold uppercase tracking-tight sm:text-lg">Doctor Operations Portal</h1>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{doctor ? `${doctor.callSign} · ${doctor.rank}` : "Medical Workspace"}</p>
            </div>
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            {doctor ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/12 via-cyan-400/10 to-transparent px-3 py-2 text-left shadow-[0_14px_30px_rgba(0,229,255,0.08)] transition-all hover:border-primary/35 hover:bg-primary/15">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/12 text-primary shadow-inner">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="leading-tight">
                      <div className="text-sm font-semibold text-foreground">{doctor.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary/90">
                        {doctor.callSign} · {doctor.rank}
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl border-primary/15 bg-card/95 p-2 shadow-[0_24px_50px_rgba(0,0,0,0.35)]">
                  <DropdownMenuLabel className="rounded-xl bg-primary/10 px-3 py-2">
                    <div className="text-sm font-semibold text-foreground">{doctor.name}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                      {doctor.callSign} · {doctor.rank}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/40" />
                  <DropdownMenuItem
                    className="rounded-xl px-3 py-2.5 font-medium"
                    onClick={() => setProfileOpenId(doctor.memberId)}
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    Open EMS Profile Card
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl px-3 py-2.5 font-medium" onClick={() => void logout()}>
                    <LogOut className="h-4 w-4 text-primary" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-screen-2xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/doctor" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/40 bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
      <PersonnelDossierDialog memberId={profileOpenId} onClose={() => setProfileOpenId(null)} />
    </div>
  );
}
