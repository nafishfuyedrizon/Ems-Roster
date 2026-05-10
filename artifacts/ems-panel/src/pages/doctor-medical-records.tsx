import { Link } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { doctorFetch } from "@/lib/doctor-api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function DoctorMedicalRecords() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data } = useDoctorQuery<any[]>("doctor-medical-records", "/medical-records");
  const { data: mfcCases } = useDoctorQuery<any[]>("doctor-completed-mfc-records", "/mfc-cases");
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const completedMfcCases = (mfcCases ?? []).filter((item) => item.status === "completed");

  const saveRecord = async (id: number) => {
    await doctorFetch(`/medical-records/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ internalNotes: drafts[id] || "" }),
    });
    await queryClient.invalidateQueries({ queryKey: ["doctor-medical-records"] });
  };

  const generatePrintLink = async (id: number) => {
    const response = await doctorFetch<{ directUrl: string }>(`/documents/medical-record/${id}/print-version`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    toast({ title: "Medical record print link ready", description: response.directUrl });
  };

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Medical Records</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Imported treatment history, structured follow-up notes, and confirmed MFC certificates</p>
        </div>
        {completedMfcCases.length ? (
          <div className="grid gap-4">
            {completedMfcCases.map((record) => (
              <Card key={`mfc-${record.id}`} className="border-emerald-500/20 bg-card/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{record.applicantName}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        CID: {record.cid || "N/A"} · MFC Reason: {record.mfcReason || "Medical Fitness Certificate"}
                      </p>
                    </div>
                    <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
                      Confirmed MFC
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Date: {record.examDateText || "N/A"}</p>
                    <p>Officer: {record.officerName || "N/A"}</p>
                    <p>Status: {record.status}</p>
                  </div>
                  <Link href={`/doctor/mfc/${record.id}`} className="text-primary underline">
                    Open Certificate
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
        <div className="grid gap-4">
          {(data ?? []).map((record) => (
            <Card key={record.id} className="border-border/50 bg-card/50">
              <CardHeader><CardTitle>{record.patientName}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">CID: {record.cid || "N/A"} · Done By: {record.doneByText || "N/A"}</p>
                <p className="text-sm">{record.injuryDetails || "No injury details"}</p>
                <p className="text-sm text-cyan-100">{record.treatmentDetails || "No treatment details"}</p>
                <Textarea value={drafts[record.id] ?? record.internalNotes ?? ""} onChange={(event) => setDrafts((prev) => ({ ...prev, [record.id]: event.target.value }))} />
                <div className="flex gap-3">
                  <Button onClick={() => void saveRecord(record.id)} variant="outline">Save Follow-up Notes</Button>
                  <Button onClick={() => void generatePrintLink(record.id)}>Generate Print Link</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
