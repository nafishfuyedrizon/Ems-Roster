import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { DoctorPageShell } from "@/pages/doctor-shared";
import { doctorFetch } from "@/lib/doctor-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PrintVersionsPanel } from "@/pages/doctor-components";

export default function DoctorMfcDetail() {
  const queryClient = useQueryClient();
  const [, params] = useRoute("/doctor/mfc/:id");
  const id = Number(params?.id);
  const { data } = useQuery<any>({ queryKey: ["doctor-mfc-detail", id], queryFn: () => doctorFetch(`/mfc-cases/${id}`), enabled: Number.isFinite(id) });
  const [draft, setDraft] = useState<Record<string, any>>({});

  const save = async () => {
    await doctorFetch(`/mfc-cases/${id}`, { method: "PATCH", body: JSON.stringify(draft) });
    await queryClient.invalidateQueries({ queryKey: ["doctor-mfc-detail", id] });
  };

  const complete = async () => {
    await doctorFetch(`/mfc-cases/${id}/complete`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["doctor-mfc-detail", id] });
  };

  return (
    <DoctorPageShell>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle>MFC Case Editor</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {["applicantName", "cid", "sex", "dateOfBirth", "number", "weight", "examDateText", "officerName"].map((field) => (
              <Input key={field} defaultValue={data?.[field] || ""} placeholder={field} onChange={(event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))} />
            ))}
            <Textarea defaultValue={data?.mfcReason || ""} placeholder="MFC reason" className="md:col-span-2" onChange={(event) => setDraft((prev) => ({ ...prev, mfcReason: event.target.value }))} />
            <Textarea defaultValue={data?.bloodTest || ""} placeholder="Blood test" className="md:col-span-2" onChange={(event) => setDraft((prev) => ({ ...prev, bloodTest: event.target.value }))} />
            <Textarea defaultValue={data?.mriTest || ""} placeholder="MRI test" className="md:col-span-2" onChange={(event) => setDraft((prev) => ({ ...prev, mriTest: event.target.value }))} />
            <Textarea defaultValue={data?.eyeTest || ""} placeholder="Eye test" className="md:col-span-2" onChange={(event) => setDraft((prev) => ({ ...prev, eyeTest: event.target.value }))} />
            <Textarea defaultValue={data?.finalSummary || ""} placeholder="Final summary" className="md:col-span-2" onChange={(event) => setDraft((prev) => ({ ...prev, finalSummary: event.target.value }))} />
            <div className="flex gap-3 md:col-span-2">
              <Button onClick={() => void save()}>Save Changes</Button>
              <Button variant="outline" onClick={() => void complete()}>Complete MFC</Button>
            </div>
          </CardContent>
        </Card>
        <PrintVersionsPanel documentType="mfc" documentId={id} />
      </div>
    </DoctorPageShell>
  );
}
