import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { DoctorPageShell } from "@/pages/doctor-shared";
import { doctorFetch } from "@/lib/doctor-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DoctorPatientDetail() {
  const [, params] = useRoute("/doctor/patients/:id");
  const patientId = Number(params?.id);
  const { data } = useQuery<any>({
    queryKey: ["doctor-patient", patientId],
    queryFn: () => doctorFetch(`/patients/${patientId}`),
    enabled: Number.isFinite(patientId),
  });

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">{data?.name || "Patient Timeline"}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Unified patient master timeline</p>
        </div>
        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle>Patient Overview</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-2">
            <p>CID: {data?.cid || "N/A"}</p>
            <p>Phone: {data?.phone || "N/A"}</p>
            <p>Sex: {data?.sex || "N/A"}</p>
            <p>DOB: {data?.dateOfBirth || "N/A"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.timeline ?? []).map((item: any) => (
              <div key={`${item.type}-${item.id}`} className="rounded-lg border border-border/40 bg-background/40 p-3">
                <p className="font-semibold capitalize">{item.type.replace("-", " ")}</p>
                <p className="text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.occurredAt || "Unknown date"} · {item.status}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DoctorPageShell>
  );
}
