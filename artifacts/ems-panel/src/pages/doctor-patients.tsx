import { Link } from "wouter";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DoctorPatients() {
  const { data } = useDoctorQuery<any[]>("doctor-patients", "/patients");

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Patients</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Patient master list linked by CID</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((patient) => (
            <Card key={patient.id} className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>{patient.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">CID: {patient.cid || "N/A"}</p>
                <p className="text-muted-foreground">Phone: {patient.phone || "N/A"}</p>
                <Link href={`/doctor/patients/${patient.id}`} className="text-primary underline">Open patient timeline</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
