import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DoctorCalendar() {
  const { data } = useDoctorQuery<any[]>("doctor-calendar", "/doctor-calendar");
  const grouped = (data ?? []).reduce<Record<string, any[]>>((acc, row) => {
    const key = row.scheduledAtText || new Date(row.postedAt).toLocaleDateString();
    acc[key] ??= [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Doctor Calendar</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Appointment-driven scheduling board</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(grouped).map(([day, rows]) => (
            <Card key={day} className="border-border/50 bg-card/50">
              <CardHeader><CardTitle>{day}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                    <p className="font-semibold">{row.patientName}</p>
                    <p className="text-xs text-muted-foreground">{row.appointmentTypeLabel || "Appointment"} · {row.status}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
