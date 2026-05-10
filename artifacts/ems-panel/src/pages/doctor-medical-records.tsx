import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { doctorFetch } from "@/lib/doctor-api";
import { useToast } from "@/hooks/use-toast";

export default function DoctorMedicalRecords() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data } = useDoctorQuery<any[]>("doctor-medical-records", "/medical-records");
  const [drafts, setDrafts] = useState<Record<number, string>>({});

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
          <p className="mt-1 font-mono text-sm text-muted-foreground">Imported treatment history with structured follow-up notes</p>
        </div>
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
