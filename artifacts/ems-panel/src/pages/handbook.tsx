import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookOpen, AlertTriangle, Radio, Car, Stethoscope, Shield,
  Navigation, Users, Zap, ChevronDown, ChevronRight,
  Heart, Pill, DollarSign, Info, Star, Bell, CheckCircle2,
  XCircle, ShieldCheck, Activity, Ambulance, Phone,
} from "lucide-react";

/* ─── Section registry ─── */
const SECTIONS = [
  { id: "intro",    label: "Introduction",      icon: BookOpen,     color: "text-cyan-400",    glow: "shadow-cyan-500/10" },
  { id: "rules",    label: "General Rules",     icon: Shield,       color: "text-red-400",     glow: "shadow-red-500/10" },
  { id: "codes",    label: "10-Codes & Radio",  icon: Radio,        color: "text-teal-400",    glow: "shadow-teal-500/10" },
  { id: "ranks",    label: "Rank Structure",    icon: Users,        color: "text-amber-400",   glow: "shadow-amber-500/10" },
  { id: "medevac",  label: "MedEvac",           icon: Navigation,   color: "text-sky-400",     glow: "shadow-sky-500/10" },
  { id: "calls",    label: "Types of Calls",    icon: Bell,         color: "text-orange-400",  glow: "shadow-orange-500/10" },
  { id: "vehicles", label: "Vehicles",          icon: Car,          color: "text-violet-400",  glow: "shadow-violet-500/10" },
  { id: "commands", label: "Commands",          icon: Zap,          color: "text-yellow-400",  glow: "shadow-yellow-500/10" },
  { id: "medical",  label: "Medical Cases",     icon: Stethoscope,  color: "text-emerald-400", glow: "shadow-emerald-500/10" },
  { id: "surgeon",  label: "Surgeon's Guide",   icon: Heart,        color: "text-pink-400",    glow: "shadow-pink-500/10" },
  { id: "pricing",  label: "Price List",        icon: DollarSign,   color: "text-green-400",   glow: "shadow-green-500/10" },
] as const;
type SectionId = typeof SECTIONS[number]["id"];

/* ─── Reusable primitives ─── */
function SectionWrap({ id, title, icon: Icon, color, glow, children }: {
  id: string; title: string; icon: React.ElementType; color: string; glow: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section id={id} className="scroll-mt-24">
      <div className={cn("rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden shadow-lg", glow)}>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <span className="flex items-center gap-3">
            <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color.replace("text-", "bg-").replace("400", "500/10"), "border", color.replace("text-", "border-").replace("400", "500/20"))}>
              <Icon className={cn("w-4 h-4", color)} />
            </span>
            <span className="font-bold uppercase tracking-widest text-sm text-foreground">{title}</span>
          </span>
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
        </button>
        {open && (
          <div className="px-5 pb-5 space-y-4 border-t border-border/30">
            <div className="pt-4 space-y-4">{children}</div>
          </div>
        )}
      </div>
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-primary/60 pb-1 border-b border-border/30">
      {children}
    </p>
  );
}

type RuleVariant = "ok" | "warn" | "danger" | "info" | "neutral";
function Rule({ text, v = "neutral" }: { text: string; v?: RuleVariant }) {
  const cfg: Record<RuleVariant, { bg: string; border: string; icon: React.ElementType; ic: string }> = {
    ok:      { bg: "bg-emerald-500/5",  border: "border-emerald-500/20", icon: CheckCircle2,   ic: "text-emerald-400" },
    warn:    { bg: "bg-yellow-500/5",   border: "border-yellow-500/20",  icon: AlertTriangle,  ic: "text-yellow-400" },
    danger:  { bg: "bg-red-500/5",      border: "border-red-500/25",     icon: XCircle,        ic: "text-red-400" },
    info:    { bg: "bg-blue-500/5",     border: "border-blue-500/20",    icon: Info,           ic: "text-blue-400" },
    neutral: { bg: "bg-muted/15",       border: "border-border/25",      icon: ShieldCheck,    ic: "text-muted-foreground/40" },
  };
  const { bg, border, icon: Icon, ic } = cfg[v];
  return (
    <div className={cn("flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm leading-relaxed", bg, border)}>
      <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", ic)} />
      <span className="text-foreground/80">{text}</span>
    </div>
  );
}

function CodeBadge({ code, desc, hot }: { code: string; desc: string; hot?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg border text-sm",
      hot ? "bg-primary/8 border-primary/25" : "bg-muted/10 border-border/20"
    )}>
      <kbd className={cn(
        "shrink-0 px-2 py-0.5 rounded text-xs font-bold font-mono border min-w-[52px] text-center",
        hot ? "bg-primary/15 border-primary/30 text-primary" : "bg-muted/30 border-border/40 text-teal-400"
      )}>{code}</kbd>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}

const RANKS = [
  { tier: "High Command", color: "amber",  entries: [
    { rank: "Director",            note: "Highest Authority" },
    { rank: "Deputy Director",     note: "" },
    { rank: "Assistant Director",  note: "" },
    { rank: "Captain",             note: "" },
    { rank: "Lieutenant",          note: "" },
  ]},
  { tier: "Command", color: "violet", entries: [
    { rank: "Sergeant First Class", note: "Surgeon Exam Required" },
    { rank: "Sergeant",             note: "" },
    { rank: "Senior Specialist",    note: "" },
    { rank: "Specialist",           note: "Exam Required" },
  ]},
  { tier: "Patrol", color: "emerald", entries: [
    { rank: "Senior Paramedic", note: "" },
    { rank: "Paramedic",        note: "" },
    { rank: "EMT",              note: "" },
    { rank: "EMS Student",      note: "Entry Level" },
  ]},
];

export default function Handbook() {
  const [active, setActive] = useState<SectionId>("intro");
  const clickedRef = useRef(false);

  useEffect(() => {
    const ids = SECTIONS.map(s => s.id);
    const observers: IntersectionObserver[] = [];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !clickedRef.current) {
            setActive(id as SectionId);
          }
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  const scrollTo = (id: SectionId) => {
    clickedRef.current = true;
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { clickedRef.current = false; }, 1000);
  };

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── HERO ── */}
        <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-gradient-to-br from-card via-card/80 to-card/50 p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 mb-2">Official Reference Document</p>
              <h1 className="text-4xl font-black tracking-tight uppercase text-foreground">EMS Handbook</h1>
              <p className="text-muted-foreground font-mono text-sm mt-1.5">
                San Andreas Emergency Medical Service · Legacy Roleplay Bangladesh
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Ambulance className="w-8 h-8 text-primary" />
              </div>
              <div className="text-right">
                <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-xs mb-1">CONFIDENTIAL</Badge>
                <p className="text-[10px] text-muted-foreground font-mono">AUTHORIZED PERSONNEL ONLY</p>
              </div>
            </div>
          </div>
          {/* Quick nav pills */}
          <div className="relative mt-6 flex flex-wrap gap-1.5">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all",
                  active === s.id
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-muted/15 border-border/30 text-muted-foreground hover:border-border/60 hover:text-foreground"
                )}
              >
                <s.icon className={cn("w-3 h-3", active === s.id ? "text-primary" : s.color)} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-6 items-start">
          {/* Sidebar */}
          <aside className="hidden xl:block w-52 shrink-0 sticky top-24 space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted-foreground/50 px-3 pb-2">Navigate</p>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono text-left transition-all",
                  active === s.id
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                )}>
                <s.icon className={cn("w-3.5 h-3.5 shrink-0", active === s.id ? "text-primary" : s.color)} />
                {s.label}
              </button>
            ))}
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-4 min-w-0">

            {/* ── INTRODUCTION ── */}
            <SectionWrap id="intro" title="Introduction" icon={BookOpen} color="text-cyan-400" glow="shadow-cyan-500/5">
              <div className="relative rounded-xl overflow-hidden border border-cyan-500/15 bg-gradient-to-br from-cyan-500/5 to-transparent p-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                <p>Welcome to the <span className="text-foreground font-semibold">Emergency Medical Service</span>. As an EMS you have an important job working for the San Andreas Medical Service. While on duty you serve as a <span className="text-cyan-300">peacemaker</span>, a <span className="text-cyan-300">mentor</span>, and a <span className="text-cyan-300">helper</span>.</p>
                <p>All calls and tasks are to be handled with the utmost professionalism. You are an immediate reflection of the department — we are counting on <span className="text-white font-bold">YOU</span> to make a difference. Take your rank as a medal, as an achievement to the duties you perform.</p>
                <p className="text-yellow-300/80 border-l-2 border-yellow-500/40 pl-3">Disobeying any rules within this document may result in a <strong>strike</strong> or <strong>expulsion</strong> from the force.</p>
              </div>
            </SectionWrap>

            {/* ── GENERAL RULES ── */}
            <SectionWrap id="rules" title="General Rules" icon={Shield} color="text-red-400" glow="shadow-red-500/5">
              <SubHead>Conduct & Discipline</SubHead>
              <div className="space-y-1.5">
                <Rule v="danger"  text="Aggressive or threatening behavior towards ANY EMS member = severe consequences up to immediate termination." />
                <Rule v="danger"  text="Do NOT give CPR for fun or to revive off-duty friends. Misuse = Strike." />
                <Rule v="danger"  text="Anyone ON-Duty and not in Discord Dispatch = immediate strike." />
                <Rule v="warn"    text="Always park your vehicle in the Garage and LOCK your doors after patrolling." />
                <Rule v="warn"    text="Always wear the correct uniform when on duty." />
                <Rule v="warn"    text="Drive only the vehicle authorized to your rank." />
                <Rule v="neutral" text="Always follow your Chain of Command regardless of rank." />
                <Rule v="neutral" text="Vehicle customization: Only Extras, Liveries, and Respray are allowed." />
                <Rule v="neutral" text="/checkin allowed from Paramedic+. Only 911 patients and Government Employees (Police, DOJ, EMS) are eligible." />
                <Rule v="neutral" text="Always take the patient to the nearest hospital possible." />
                <Rule v="neutral" text="Always patrol with proper patrolling code on radio/dispatch." />
              </div>

              <SubHead>Crime Scene Protocol</SubHead>
              <div className="space-y-1.5">
                <Rule v="neutral" text="If a criminal flees a Medical Center — NOT your job to chase them. Let police handle it." />
                <Rule v="warn"    text="During 10-90 (Bank Robbery): Stay 100 ft from scene. Once suspects leave → check hostage for medical attention." />
                <Rule v="danger"  text="During Code Red: Do NOT enter the scene until police confirm all clear." />
              </div>

              <SubHead>EMS Server Rules</SubHead>
              <div className="space-y-1.5">
                <Rule v="info" text="(9.1) Consult nearest officer at a crime scene. If unavailable, call them or proceed with extreme caution." />
                <Rule v="info" text="(9.2) When going off-duty, dispose of all hospital-issued equipment and vehicles." />
                <Rule v="info" text="(9.3) Do NOT abuse medic powers to assist friends." />
                <Rule v="danger" text="(9.3.1) CANNOT revive individuals involved in serious situations: gunshots, stab wounds, etc." />
                <Rule v="ok"    text="(9.3.2) CAN revive individuals from minor situations: minor vehicle collision, fist fights, etc." />
                <Rule v="info"  text="(9.4) A working microphone is required at all times while on duty." />
              </div>
            </SectionWrap>

            {/* ── 10-CODES ── */}
            <SectionWrap id="codes" title="10-Codes & Radio Communication" icon={Radio} color="text-teal-400" glow="shadow-teal-500/5">
              <SubHead>Response Codes</SubHead>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {[
                  { code: "Code 0", desc: "Game Crash / Lagged Out" },
                  { code: "Code 1", desc: "Routine Patrol — No Lights or Sirens", hot: true },
                  { code: "Code 2", desc: "Routine Call — Lights On, Airhorn at Intersections", hot: true },
                  { code: "Code 3", desc: "EMERGENCY — Lights and Sirens On", hot: true },
                  { code: "Code 4", desc: "Situation Finished / All Clear", hot: true },
                  { code: "Code 6", desc: "Searching Area for Patient" },
                ].map(c => <CodeBadge key={c.code} {...c} />)}
              </div>

              <SubHead>Standard 10-Codes</SubHead>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {[
                  { code: "10-3",  desc: "Stop Radio Chatter" },
                  { code: "10-4",  desc: "Acknowledgement — OK" },
                  { code: "10-6",  desc: "Busy / Stand by unless urgent" },
                  { code: "10-7",  desc: "Out of Service" },
                  { code: "10-8",  desc: "Back in Service" },
                  { code: "10-10", desc: "Negative" },
                  { code: "10-14", desc: "Officer / EMS Down" },
                  { code: "10-16", desc: "Return to Hospital" },
                  { code: "10-20", desc: "Location" },
                  { code: "10-23", desc: "Arrived at Scene", hot: true },
                  { code: "10-41", desc: "Beginning Tour of Duty — ON DUTY", hot: true },
                  { code: "10-42", desc: "Ending Tour of Duty — OFF DUTY", hot: true },
                  { code: "10-47", desc: "Patient / Injured Person", hot: true },
                  { code: "10-52", desc: "Call EMS (Used by SASP)" },
                  { code: "10-76", desc: "En Route", hot: true },
                  { code: "10-78", desc: "Need Backup" },
                  { code: "10-91", desc: "Need Backup — Vehicle Unit" },
                  { code: "10-99", desc: "Officer in Distress" },
                ].map(c => <CodeBadge key={c.code} {...c} />)}
              </div>

              <SubHead>Radio Examples</SubHead>
              <div className="space-y-1.5">
                {[
                  { ctx: "Emergency Call",     line: "This is (S-212) responding to the latest 911 call" },
                  { ctx: "Arrived at Scene",   line: "This is (S-212) 10-23" },
                  { ctx: "Return to Hospital", line: "This is (S-212) 10-76 to 10-16 with (1+) 10-47 Code 2" },
                  { ctx: "Backup Request",     line: "This is (S-212) 10-91 at 10-20" },
                  { ctx: "Situation Done",     line: "This is (S-212) Code 4" },
                ].map(({ ctx, line }) => (
                  <div key={ctx} className="flex items-start gap-3 px-4 py-2.5 rounded-lg border border-border/25 bg-muted/10 text-xs">
                    <span className="font-mono text-teal-400/70 w-32 shrink-0">[{ctx}]</span>
                    <span className="text-foreground/70 font-mono">{line}</span>
                  </div>
                ))}
              </div>
              <Rule v="warn" text="If you are ON-Duty, you MUST be in the appropriate Discord Dispatch channel. Failure = strike." />
            </SectionWrap>

            {/* ── RANKING STRUCTURE ── */}
            <SectionWrap id="ranks" title="Ranking Structure" icon={Users} color="text-amber-400" glow="shadow-amber-500/5">
              <div className="space-y-4">
                {RANKS.map(({ tier, color, entries }) => {
                  const colors: Record<string, { card: string; dot: string; label: string; border: string }> = {
                    amber:   { card: "from-amber-500/8 to-transparent",  dot: "bg-amber-400",   label: "text-amber-300",  border: "border-amber-500/20" },
                    violet:  { card: "from-violet-500/8 to-transparent", dot: "bg-violet-400",  label: "text-violet-300", border: "border-violet-500/20" },
                    emerald: { card: "from-emerald-500/8 to-transparent",dot: "bg-emerald-400", label: "text-emerald-300",border: "border-emerald-500/20" },
                  };
                  const c = colors[color];
                  return (
                    <div key={tier}>
                      <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-2 text-[10px] font-mono font-bold uppercase tracking-widest", c.border, c.label.replace("text-", "bg-").replace("300","500/10"))}>
                        <Star className={cn("w-3 h-3", c.label)} />
                        <span className={c.label}>{tier}</span>
                      </div>
                      <div className={cn("rounded-xl border p-3 bg-gradient-to-br space-y-1.5", c.border, c.card)}>
                        {entries.map(({ rank, note }, i) => (
                          <div key={rank} className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-black/10 border border-white/5">
                            <span className="text-muted-foreground/40 font-mono text-[10px] w-4 text-right shrink-0">{i + 1}</span>
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
                            <span className={cn("font-semibold text-sm flex-1", c.label)}>{rank}</span>
                            {note && <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/20 px-2 py-0.5 rounded-full border border-border/20">{note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Rule v="info" text="Promotions are given without bias — only earned through hard work, dedication, and work ethic. Exams required for Specialist and Surgeon ranks." />
            </SectionWrap>

            {/* ── MEDEVAC ── */}
            <SectionWrap id="medevac" title="MedEvac Operations" icon={Navigation} color="text-sky-400" glow="shadow-sky-500/5">
              <SubHead>Rules & Restrictions</SubHead>
              <div className="space-y-1.5">
                <Rule v="danger"  text="Do NOT use the helicopter for personal rides. Only for: far calls within the fly zone, critical patient transfers, or when cleared by a superior." />
                <Rule v="danger"  text="EMT to Specialist: Cannot give CPR during MedEvac/outside-city calls without valid reason." />
                <Rule v="warn"    text="Wear the proper MedEvac uniform while flying." />
                <Rule v="warn"    text="Cannot go patrolling with MedEvac." />
                <Rule v="warn"    text="Cannot land on highways, roads with traffic, or roads with cables/many buildings." />
                <Rule v="ok"      text="CAN land on rooftops and on beaches in certain situations." />
                <Rule v="neutral" text="Maximum 3 patients (/suspect in) per MedEvac." />
                <Rule v="neutral" text="MedEvac Trainees: Cannot join 10-90 chases. MedEvac Advance can." />
                <Rule v="neutral" text="Pilot must always stay inside or close to the helicopter while the partner treats patients." />
                <Rule v="info"    text="MedEvac Advanced & FireFighter licenses can be USED from Sergeant First Class rank." />
              </div>

              <SubHead>License System</SubHead>
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 bg-black/20 border-b border-border/20 flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400/60">Exam Order — Must be completed in sequence</span>
                </div>

                {/* Step 1 — MedEvac Trainee */}
                <div className="flex items-start gap-4 px-4 py-3.5 border-b border-border/15">
                  <div className="w-7 h-7 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sky-400 font-bold text-xs">1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-foreground">MedEvac Trainee 🚁</span>
                      <span className="text-[10px] font-mono text-sky-400/80 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">Exam</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Eligible from <span className="text-emerald-400 font-semibold">Paramedic</span> rank and above</p>
                  </div>
                </div>

                {/* Step 2 — MedEvac Advanced */}
                <div className="flex items-start gap-4 px-4 py-3.5 border-b border-border/15 bg-black/10">
                  <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-blue-400 font-bold text-xs">2</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-foreground">MedEvac Advanced 🚁🚁</span>
                      <span className="text-[10px] font-mono text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">Exam</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Eligible from <span className="text-emerald-400 font-semibold">Senior Specialist</span> rank and above</p>
                    <p className="text-[11px] text-yellow-400/70 mt-0.5">⚠ Must hold MedEvac Trainee license first</p>
                  </div>
                </div>

                {/* Step 3 — FireFighter */}
                <div className="flex items-start gap-4 px-4 py-3.5 border-b border-border/15">
                  <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-red-400 font-bold text-xs">3</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-foreground">FireFighter 🚒</span>
                      <span className="text-[10px] font-mono text-red-400/80 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">Exam</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Eligible from <span className="text-emerald-400 font-semibold">Sergeant</span> rank and above</p>
                    <p className="text-[11px] text-yellow-400/70 mt-0.5">⚠ Must hold MedEvac Advanced license first</p>
                  </div>
                </div>

                {/* TVU — parallel path */}
                <div className="flex items-start gap-4 px-4 py-3.5 border-b border-border/15 bg-black/10">
                  <div className="w-7 h-7 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-violet-400 font-bold text-xs">4</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-foreground">TVU</span>
                      <span className="text-[10px] font-mono text-violet-400/80 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">Exam</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Eligible from <span className="text-emerald-400 font-semibold">Senior Specialist</span> rank and above</p>
                  </div>
                </div>

                {/* Usage rule */}
                <div className="px-4 py-3 bg-amber-500/5 border-t border-amber-500/15 flex items-start gap-3">
                  <span className="text-amber-400 text-base shrink-0">⭐</span>
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    <span className="font-bold text-amber-400">MedEvac Advanced</span> and <span className="font-bold text-amber-400">FireFighter</span> licenses can only be <span className="underline underline-offset-2">actively used</span> from <span className="font-semibold text-white">Sergeant First Class</span> rank onwards.
                  </p>
                </div>
              </div>

              <SubHead>Flight Controls</SubHead>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  ["W","Ascend"],["S","Descend"],["A","Rotate Left"],["D","Rotate Right"],
                  ["F","Enter / Exit"],["B","Seatbelt"],["L","Lock / Unlock"],["X","Rappel Down"],
                  ["8","Forward"],["5","Backward"],["4","Move Left"],["6","Move Right"],
                ].map(([key, action]) => (
                  <div key={key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/15 border border-border/25 text-xs">
                    <kbd className="w-6 h-6 flex items-center justify-center rounded bg-muted border border-border/60 text-foreground font-mono font-bold text-xs shrink-0">{key}</kbd>
                    <span className="text-muted-foreground text-[11px]">{action}</span>
                  </div>
                ))}
              </div>

              <SubHead>Authorized Helicopters</SubHead>
              <div className="space-y-1.5">
                {[
                  { name: "Western Maverick",           auth: "MedEvac Trainee+",  use: "Rescue & 10-90 Chase" },
                  { name: "Eurocopter AS332 EMS Airbus", auth: "MedEvac Advance Only", use: "Rescue Only" },
                  { name: "EMS Pontoon Rescue Helicopter",auth: "Authorized",         use: "Water Rescue Only" },
                  { name: "Rescue Life Flight Helicopter",auth: "MedEvac Advance Only", use: "Rescue Only" },
                ].map(({ name, auth, use }) => (
                  <div key={name} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-sky-500/15 bg-sky-500/5 text-sm">
                    <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-foreground font-semibold flex-1">{name}</span>
                    <span className="text-[10px] font-mono text-sky-400/70 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full shrink-0">{auth}</span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:block">{use}</span>
                  </div>
                ))}
              </div>
            </SectionWrap>

            {/* ── TYPES OF CALLS ── */}
            <SectionWrap id="calls" title="Types of Calls" icon={Bell} color="text-orange-400" glow="shadow-orange-500/5">
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Car,      color: "text-orange-400", bg: "bg-orange-500/8 border-orange-500/20",
                    name: "Motor Vehicle Accident (MVA)",
                    desc: "3 categories: Vehicle vs Pedestrian, Vehicle vs Vehicle, Vehicle vs Static. Respond Code 3. Assess and transport." },
                  { icon: Activity, color: "text-red-400",    bg: "bg-red-500/8 border-red-500/20",
                    name: "Fire & Standby Calls",
                    desc: "Drive to scene, inform dispatch of arrival. Wait nearby for support. Notify dispatch when done and return to base." },
                  { icon: Phone,    color: "text-yellow-400", bg: "bg-yellow-500/8 border-yellow-500/20",
                    name: "Life Alert",
                    desc: "Could be a dying or unconscious person. Respond ASAP with Code 3. Consider police support based on location." },
                ].map(({ icon: Icon, color, bg, name, desc }) => (
                  <div key={name} className={cn("rounded-xl p-4 border space-y-2", bg)}>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-black/20")}>
                      <Icon className={cn("w-4 h-4", color)} />
                    </div>
                    <p className="font-bold text-sm text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </SectionWrap>

            {/* ── VEHICLES ── */}
            <SectionWrap id="vehicles" title="Authorized Vehicles" icon={Car} color="text-violet-400" glow="shadow-violet-500/5">
              <SubHead>Standard Vehicles</SubHead>
              <div className="space-y-1.5">
                <Rule text="F-450 Ambulance — EMT to Senior Paramedic. Mandatory extras: Only Extra 6 & 7." />
                <Rule text="Ford Explorer — Specialist and Above." />
              </div>

              <SubHead>Vehicle Color by Rank</SubHead>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {[
                  { rank: "Specialist",           color: "Saxony Blue",      dot: "bg-blue-500" },
                  { rank: "Senior Specialist",    color: "Dark Green",       dot: "bg-green-600" },
                  { rank: "Sergeant",             color: "Sun Bleached Sand", dot: "bg-yellow-700" },
                  { rank: "Sergeant First Class", color: "Dark Blue",        dot: "bg-blue-800" },
                  { rank: "Lieutenant",           color: "Black",            dot: "bg-gray-900 border border-gray-600" },
                  { rank: "Captain",              color: "White",            dot: "bg-white border border-gray-400" },
                ].map(({ rank, color, dot }) => (
                  <div key={rank} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/25 bg-muted/10 text-xs">
                    <div className={cn("w-3 h-3 rounded-full shrink-0", dot)} />
                    <span className="text-muted-foreground flex-1 font-mono">{rank}</span>
                    <span className="text-foreground font-semibold">{color}</span>
                  </div>
                ))}
              </div>

              <SubHead>Extra Vehicles (Emergency & Rescue Only)</SubHead>
              <div className="space-y-1.5">
                <Rule text="Ladder Fire Truck — Senior FireFighter and Above." />
                <Rule text="Firetruck / Pump Fire Truck — FireFighter and Above." />
                <Rule text="Bush Ram Firetruck — Fire Lieutenant+. Also Code-1 authorized from Lieutenant." />
                <Rule text="EMS Rescue Boat — Paramedic and Above." />
                <Rule text="BMW 1200 RT — FireFighter+. RRU members Code-1 authorized." />
                <Rule text="Romero Hearse — High Command permission only. For carrying dead bodies." />
                <Rule text="Wheel Chair — Certified Surgeon's permission only. For physically injured patients." />
              </div>
            </SectionWrap>

            {/* ── COMMANDS ── */}
            <SectionWrap id="commands" title="In-Game Commands" icon={Zap} color="text-yellow-400" glow="shadow-yellow-500/5">
              <div className="grid sm:grid-cols-2 gap-1.5">
                {[
                  { cmd: "/escort",          desc: "Grab or let go of a person" },
                  { cmd: "/suspect [in/out]",desc: "Put person in or out of a vehicle (max 3 in MedEvac)" },
                  { cmd: "/cpr",             desc: "Heal patients — cannot fix injuries. Sgt+ independently." },
                  { cmd: "/Impound",         desc: "Impound any vehicle" },
                  { cmd: "/Repair",          desc: "Repair your Emergency vehicle" },
                  { cmd: "/tracker",         desc: "Turn your tracker on/off" },
                  { cmd: "/livery [1/2/3]",  desc: "Change livery of an emergency vehicle" },
                  { cmd: "/unit_id [sign]",  desc: "Show your call-sign on the map with tracker" },
                  { cmd: "/uc",              desc: "Uncuff a person near you" },
                  { cmd: "/checkin",         desc: "Check in someone for free — Paramedic+ only" },
                  { cmd: "/training",        desc: "Use during any training programme" },
                  { cmd: "/extra",           desc: "Modify vehicle extras" },
                  { cmd: "/deleteoutfit",    desc: "Delete all saved outfits (for Plastic Surgery)" },
                ].map(({ cmd, desc }) => (
                  <div key={cmd} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border/25 bg-muted/10 text-xs">
                    <span className="font-mono font-bold text-yellow-400 shrink-0 w-[140px]">{cmd}</span>
                    <span className="text-muted-foreground leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>
              <Rule v="danger" text="Do NOT misuse /cpr for personal gain or fun. Found abusing it = Strike." />
            </SectionWrap>

            {/* ── MEDICAL CASES ── */}
            <SectionWrap id="medical" title="Medical Cases" icon={Stethoscope} color="text-emerald-400" glow="shadow-emerald-500/5">
              <Rule v="info" text="Disclaimer: This section may not be 100% accurate — open to criticism and improvement." />
              <div className="grid sm:grid-cols-2 gap-3 mt-1">
                {[
                  { icon: "🦴", name: "Spinal Injury",   color: "border-blue-500/20 bg-blue-500/5",
                    text: "Place injured person on a backboard with another EMS. One stabilizes the c-spine (neck/head) until a c-spine collar is placed. Do not let them turn their head." },
                  { icon: "🔥", name: "Burns",            color: "border-orange-500/20 bg-orange-500/5",
                    text: "Saline-soaked bandages over severe burns. Minor burns: loosely secure a gauze pressure pad over top." },
                  { icon: "⚡", name: "Shock",            color: "border-yellow-500/20 bg-yellow-500/5",
                    text: "Keep patient warm and calm. Stop the cause of shock. Administer saline packs via IV if needed to alleviate blood pressure." },
                  { icon: "🥶", name: "Hypothermia",      color: "border-cyan-500/20 bg-cyan-500/5",
                    text: "Keep the patient warm with a thermal blanket. Monitor vitals constantly." },
                  { icon: "🔫", name: "Gunshot Wounds",   color: "border-red-500/20 bg-red-500/5",
                    text: "Control bleeding with sterile gauze pads. Sanitize the wound. Wrap tightly. Chest wound: seal with plastic sheet, leave one side unsealed for drainage." },
                  { icon: "💔", name: "Cardiac Arrest",   color: "border-pink-500/20 bg-pink-500/5",
                    text: "Heart abruptly stops. Begin CPR immediately. Do NOT stop compressions until heartbeat returns to normal." },
                ].map(({ icon, name, color, text }) => (
                  <div key={name} className={cn("rounded-xl p-4 border space-y-2", color)}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{icon}</span>
                      <p className="font-bold text-sm text-foreground">{name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </SectionWrap>

            {/* ── SURGEON'S HANDBOOK ── */}
            <SectionWrap id="surgeon" title="Surgeon's Handbook" icon={Heart} color="text-pink-400" glow="shadow-pink-500/5">
              <div className="rounded-xl border border-pink-500/15 bg-pink-500/5 px-4 py-3 mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-pink-400/70 mb-1">Topics Covered</p>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-muted-foreground">
                  {["EMS Pharmacy","EMS Badges","Sign On As Doctor","CPR Rules","CPR Cases","ICU","Plastic Surgery","Laser Surgery","Price List"].map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-muted/20 border border-border/30">{t}</span>
                  ))}
                </div>
              </div>

              <SubHead>1 · EMS Pharmacy</SubHead>
              <Rule v="info"    text="Located at the 2nd Floor of Mount Zonah. Stores First Aid Kits, Bandages, Painkillers, Antibiotics." />
              <Rule v="warn"    text="ALL EMS Members must carry 10 First Aid Kits from EMS Shop when going on duty." />
              <Rule v="neutral" text="Sergeant+: Can prescribe Antibiotics or Painkillers to patients after surgery." />
              <div className="grid sm:grid-cols-2 gap-1.5">
                <div className="px-3 py-2.5 rounded-lg border border-border/25 bg-muted/10 text-xs">
                  <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5"><Pill className="w-3 h-3 text-green-400" /> Pharmacy Stash</p>
                  <p className="text-muted-foreground">Contains First Aid Kits and Bandages</p>
                </div>
                <div className="px-3 py-2.5 rounded-lg border border-border/25 bg-muted/10 text-xs">
                  <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5"><Pill className="w-3 h-3 text-pink-400" /> Drug Cabinet</p>
                  <p className="text-muted-foreground">Contains Antibiotics and Painkillers</p>
                </div>
              </div>

              <SubHead>2 · EMS Badges / ID</SubHead>
              <Rule text="EMT+: Must always carry EMS ID Badge while on duty." />
              <Rule text="Sergeant+: Must carry DOCTOR ID Badge." />

              <SubHead>3 · Sign On As a Doctor</SubHead>
              <Rule v="warn"    text="Requirement: Senior Specialist and above." />
              <Rule v="neutral" text="Minimum 2 additional EMS on duty (1 MedEvac + 1 ground unit) when signed in as Doctor." />
              <Rule v="neutral" text="Peak hours: sufficient EMS for ground/911 calls + at least 2 for Doctor sign-in." />
              <Rule v="neutral" text="Always wear the surgery uniform while signed on as Doctor, doing bed treatment, or performing surgery." />

              <SubHead>4 · CPR Rules</SubHead>
              <Rule v="danger"  text="CPR is NOT for fun or off-duty friend revival." />
              <Rule v="warn"    text="Must be Sergeant or above to give CPR independently." />
              <Rule v="neutral" text="EMT to Specialist must have a higher rank's permission to give CPR." />
              <Rule v="danger"  text="CANNOT give CPR to individuals involved in serious situations: gunshots, stab wounds, etc." />
              <Rule v="ok"      text="CAN give CPR to those in minor situations: minor vehicle collision, fist fights." />
              <Rule v="info"    text="A high-quality roleplay scenario must support any CPR given." />

              <SubHead>5 · ICU — Intensive Care Unit</SubHead>
              <Rule v="neutral" text="Use ICU for: heavy bleeding, multiple injuries, critical injuries, internal tissue damage." />
              <Rule v="warn"    text="Minimum ICU stay: 12 hours (counted OOC)." />
              <Rule v="neutral" text="Before any surgery or ICU: at least 1 available Surgeon must be present." />
              <Rule v="neutral" text="To initiate surgery: at least 2 active Surgeons required." />
              <Rule v="info"    text="After surgery, update details in #rp-medical-records on Discord." />

              <SubHead>6 · Plastic Surgery</SubHead>
              <Rule v="neutral" text="Cost: $150,000 (includes Surgeon's fees and EMS fund)." />
              <Rule v="neutral" text="Bring patient to nearest clothing shop → Patient Gown → /deleteoutfit all saved outfits." />
              <Rule v="neutral" text="Perform surgery with /me RP in OT. Request reskin: /report need to reskin ID: [patient ID]." />
              <Rule v="neutral" text="Ask for Steam ID + Steam Hex ID (OOC) and post in #plastic-surgery channel." />
              <Rule v="info"    text="Can be initiated by: 1 Surgeon + 1 non-Surgeon. FOR NOW ONLY AVAILABLE ON PACK." />

              <SubHead>7 · Laser Surgery</SubHead>
              <Rule v="neutral" text="Removes tattoos via /me RP. Requires 1 Surgeon + 1 Paramedic or above." />
              <Rule v="neutral" text="Patient must book appointment via #doctors-appointment." />
              <Rule v="neutral" text="After RP, patient joins Discord VC with in-game admin for tattoo removal. Post before/after in #surgery-data." />
            </SectionWrap>

            {/* ── PRICE LIST ── */}
            <SectionWrap id="pricing" title="Official Price List" icon={DollarSign} color="text-green-400" glow="shadow-green-500/5">

              {/* Consultation */}
              <div className="rounded-xl border border-green-500/15 bg-green-500/5 p-4 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-green-400/70 flex items-center gap-1.5 mb-3">🩺 Consultation</p>
                <div className="flex items-center justify-between px-3.5 py-2 rounded-lg border border-border/25 bg-black/20 text-sm">
                  <span className="text-foreground/80">Doctor Appointment Fee</span>
                  <span className="font-mono font-bold text-emerald-400">$500</span>
                </div>
              </div>

              {/* Medicines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400/70 flex items-center gap-1.5">💊 Medicines</p>
                  <span className="text-[10px] font-mono text-muted-foreground/50 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">Specialist+</span>
                </div>
                <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 overflow-hidden">
                  {[
                    { n: "First Aid Kit",              p: "$60" },
                    { n: "Bandage",                    p: "$25" },
                    { n: "Saline (IV)",                p: "$50" },
                    { n: "Generic Cream (Custom Name)",p: "$150" },
                    { n: "Generic Pills (Custom Name)",p: "$150" },
                    { n: "Burn Cream",                 p: "$150" },
                    { n: "Amoxicillin",                p: "$100" },
                    { n: "Paracetamol",                p: "$200" },
                    { n: "Painkiller",                 p: "$100" },
                    { n: "Antibiotic",                 p: "$100" },
                  ].map(({ n, p }, i) => (
                    <div key={n} className={cn("flex items-center justify-between px-4 py-2 text-sm", i % 2 === 0 ? "bg-black/10" : "")}>
                      <span className="text-foreground/75">{n}</span>
                      <span className="font-mono font-bold text-emerald-400">{p}</span>
                    </div>
                  ))}
                  {/* Adrenaline — Sergeant only */}
                  <div className="flex items-center justify-between px-4 py-2 text-sm bg-amber-500/5 border-t border-amber-500/15">
                    <span className="flex items-center gap-2 text-foreground/75">
                      Adrenaline
                      <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Sergeant Only</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">$1,000</span>
                  </div>
                </div>
              </div>

              {/* Tests */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-violet-400/70 flex items-center gap-1.5">🔬 Tests</p>
                  <span className="text-[10px] font-mono text-muted-foreground/50 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">Specialist+</span>
                </div>
                <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 overflow-hidden">
                  {[
                    { n: "Blood Test", p: "$200" },
                    { n: "X-Ray",      p: "$800" },
                    { n: "MRI",        p: "$1,500" },
                    { n: "MFC",        p: "$3,000" },
                  ].map(({ n, p }, i) => (
                    <div key={n} className={cn("flex items-center justify-between px-4 py-2 text-sm", i % 2 === 0 ? "bg-black/10" : "")}>
                      <span className="text-foreground/75">{n}</span>
                      <span className="font-mono font-bold text-emerald-400">{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Treatments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-orange-400/70 flex items-center gap-1.5">🩹 Treatments</p>
                  <span className="text-[10px] font-mono text-muted-foreground/50 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">Paramedic+</span>
                </div>
                <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 overflow-hidden">
                  {[
                    { n: "Bandage",         p: "$200" },
                    { n: "Plaster",         p: "$500" },
                    { n: "Wounds Dressing", p: "$100" },
                  ].map(({ n, p }, i) => (
                    <div key={n} className={cn("flex items-center justify-between px-4 py-2 text-sm", i % 2 === 0 ? "bg-black/10" : "")}>
                      <span className="text-foreground/75">{n}</span>
                      <span className="font-mono font-bold text-emerald-400">{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Surgeries */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-pink-400/70 flex items-center gap-1.5">🏥 Surgeries</p>
                  <span className="text-[10px] font-mono text-muted-foreground/50 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">Sergeant+</span>
                </div>
                <div className="rounded-xl border border-pink-500/15 bg-pink-500/5 overflow-hidden">
                  {/* Laser */}
                  <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-pink-400/50 bg-black/15 border-b border-border/20">
                    Laser Surgery
                  </div>
                  {[
                    { n: "Full Body",  p: "$30,000" },
                    { n: "Head",       p: "$10,000" },
                    { n: "Each Hand",  p: "$5,000" },
                    { n: "Each Leg",   p: "$5,000" },
                    { n: "Body Only",  p: "$10,000" },
                  ].map(({ n, p }, i) => (
                    <div key={n} className={cn("flex items-center justify-between px-4 py-2 text-sm", i % 2 === 0 ? "bg-black/10" : "")}>
                      <span className="text-foreground/75">{n}</span>
                      <span className="font-mono font-bold text-emerald-400">{p}</span>
                    </div>
                  ))}
                  {/* Plastic Surgery */}
                  <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-pink-400/50 bg-black/15 border-t border-b border-border/20 mt-1">
                    Plastic Surgery
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-black/10">
                    <span className="text-foreground/75">In-City (In-game money)</span>
                    <span className="font-mono font-bold text-emerald-400">$150,000</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-foreground/75">IRL Package</span>
                    <span className="font-mono font-bold text-yellow-400">699 Tk</span>
                  </div>
                </div>
              </div>

              <Rule v="danger" text="Everyone must maintain this official price list at all times. Any deviation is a violation." />
            </SectionWrap>

            {/* Footer */}
            <div className="relative rounded-xl border border-border/30 bg-card/40 p-6 text-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
              <Ambulance className="w-8 h-8 text-primary/30 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-[0.25em]">
                Hail EMS · Legacy Roleplay Bangladesh EMS Department
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/40 mt-1 uppercase tracking-widest">Confidential · Authorized Personnel Only</p>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
