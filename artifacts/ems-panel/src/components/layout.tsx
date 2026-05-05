import { Link, useLocation } from "wouter";
import { ShieldAlert, LayoutDashboard, Settings, Flame, ClipboardList, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/ems-roster", label: "EMS Roster", icon: ClipboardList },
    { href: "/shift-roster", label: "EMS Duty Hour", icon: Flame },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/handbook", label: "Handbook", icon: BookOpen },
    { href: "/admin", label: "Admin Panel", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6">
          <div className="flex min-h-16 items-center gap-3 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10 border border-primary/20">
                <ShieldAlert className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold leading-tight tracking-tight uppercase sm:text-lg">Legacy BD EMS</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Operations Command</p>
              </div>
            </div>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}>
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 md:hidden sm:-mx-6 sm:px-6">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/40 bg-background/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex-1 w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-border/50 px-4 py-6 text-center text-[10px] text-muted-foreground font-mono space-y-1.5 sm:px-6 sm:text-xs">
        <p className="leading-relaxed">LEGACY BD EMS ROSTER SYSTEM // CONFIDENTIAL // AUTHORIZED PERSONNEL ONLY</p>
        <p className="text-muted-foreground/50">
          <span className="text-red-500">❤</span> maintained by <span className="text-foreground/70">nafish fuyed</span>
        </p>
      </footer>
    </div>
  );
}
