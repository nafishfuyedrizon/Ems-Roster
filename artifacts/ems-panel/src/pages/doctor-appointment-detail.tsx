import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { DoctorPageShell } from "@/pages/doctor-shared";
import { useQuery } from "@tanstack/react-query";
import { doctorFetch } from "@/lib/doctor-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DoctorAppointmentDetail() {
  const [, params] = useRoute("/doctor/appointments/:id");
  const appointmentId = Number(params?.id);
  const { data } = useQuery<any>({
    queryKey: ["doctor-appointment", appointmentId],
    queryFn: () => doctorFetch(`/doctor-appointments/${appointmentId}`),
    enabled: Number.isFinite(appointmentId),
  });

  const query = useMemo(() => new URLSearchParams({
    appointmentId: String(appointmentId),
    applicantName: data?.patientName || "",
    cid: data?.cid || "",
    sex: data?.gender || "",
    dateOfBirth: data?.dateOfBirth || "",
    number: data?.contact || "",
  }).toString(), [appointmentId, data]);

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Appointment Detail</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Review source intake and branch into MFC or Prescription workflows</p>
        </div>
        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle>{data?.patientName || "Loading..."}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">CID:</span> {data?.cid || "N/A"}</p>
            <p><span className="text-muted-foreground">Contact:</span> {data?.contact || "N/A"}</p>
            <p><span className="text-muted-foreground">Gender:</span> {data?.gender || "N/A"}</p>
            <p><span className="text-muted-foreground">DOB:</span> {data?.dateOfBirth || "N/A"}</p>
            <p><span className="text-muted-foreground">Type:</span> {data?.appointmentTypeLabel || data?.appointmentRawText || "N/A"}</p>
            <div className="flex flex-wrap gap-3 pt-3">
              <Link href={`/doctor/mfc?${query}`}><Button>Create MFC</Button></Link>
              <Link href={`/doctor/prescriptions?${query}`}><Button variant="outline">Create Prescription</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DoctorPageShell>
  );
}
