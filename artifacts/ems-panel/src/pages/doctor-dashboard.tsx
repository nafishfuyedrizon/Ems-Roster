import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { DoctorStatCard } from "@/pages/doctor-components";

export default function DoctorDashboard() {
  const { data } = useDoctorQuery<any>("doctor-dashboard", "/doctor-dashboard");

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Doctor Dashboard</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Live medical workspace summary</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DoctorStatCard label="Patients" value={data?.metrics?.patients ?? 0} />
          <DoctorStatCard label="New Appointments" value={data?.metrics?.newAppointments ?? 0} />
          <DoctorStatCard label="Assigned Queue" value={data?.metrics?.assignedAppointments ?? 0} />
          <DoctorStatCard label="Pending MFC" value={data?.metrics?.pendingMfc ?? 0} />
          <DoctorStatCard label="Pending Rx" value={data?.metrics?.pendingPrescriptions ?? 0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/50 bg-card/50">
            <CardHeader><CardTitle>Recent Appointments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(data?.recentAppointments ?? []).map((item: any) => (
                <div key={item.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                  <p className="font-semibold">{item.patientName}</p>
                  <p className="text-xs text-muted-foreground">{item.appointmentTypeLabel || item.appointmentRawText || "Appointment"}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader><CardTitle>Recently Updated Patients</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(data?.recentPatients ?? []).map((item: any) => (
                <div key={item.id} className="rounded-lg border border-border/40 bg-background/40 p-3">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">CID: {item.cid || "N/A"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DoctorPageShell>
  );
}
