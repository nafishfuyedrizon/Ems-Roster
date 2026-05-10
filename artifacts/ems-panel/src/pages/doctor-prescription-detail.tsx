import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { doctorFetch } from "@/lib/doctor-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrintVersionsPanel } from "@/pages/doctor-components";

export default function DoctorPrescriptionDetail() {
  const queryClient = useQueryClient();
  const [, params] = useRoute("/doctor/prescriptions/:id");
  const id = Number(params?.id);
  const { data } = useQuery<any>({ queryKey: ["doctor-prescription-detail", id], queryFn: () => doctorFetch(`/prescriptions/${id}`), enabled: Number.isFinite(id) });
  const { data: medicines } = useDoctorQuery<any[]>("doctor-medicines", "/medicines");
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [medicineDraft, setMedicineDraft] = useState({ medicineCatalogId: "", medicineName: "", dosageText: "", instructions: "", customLabel: "", priceAmount: "0" });

  const items = useMemo(() => {
    const current = Array.isArray(data?.items) ? data.items : [];
    const extra = Array.isArray(draft.items) ? draft.items : [];
    return extra.length > 0 ? extra : current;
  }, [data, draft.items]);

  const addItem = () => {
    const selected = (medicines ?? []).find((item) => item.id === Number(medicineDraft.medicineCatalogId));
    setDraft((prev) => ({
      ...prev,
      items: [
        ...(Array.isArray(prev.items) ? prev.items : items),
        {
          medicineCatalogId: selected?.id ?? null,
          medicineName: selected?.name || medicineDraft.medicineName,
          dosageText: medicineDraft.dosageText,
          instructions: medicineDraft.instructions,
          customLabel: medicineDraft.customLabel || null,
          priceAmount: Number(selected?.defaultPrice ?? medicineDraft.priceAmount ?? 0),
        },
      ],
    }));
    setMedicineDraft({ medicineCatalogId: "", medicineName: "", dosageText: "", instructions: "", customLabel: "", priceAmount: "0" });
  };

  const save = async () => {
    await doctorFetch(`/prescriptions/${id}`, { method: "PATCH", body: JSON.stringify(draft) });
    await queryClient.invalidateQueries({ queryKey: ["doctor-prescription-detail", id] });
  };

  const complete = async () => {
    await doctorFetch(`/prescriptions/${id}/complete`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["doctor-prescription-detail", id] });
  };

  return (
    <DoctorPageShell>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle>Prescription Editor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {["patientName", "cid", "age", "sex", "weight", "prescriptionDateText"].map((field) => (
                <Input key={field} defaultValue={data?.[field] || ""} placeholder={field} onChange={(event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))} />
              ))}
            </div>
            <Textarea defaultValue={data?.symptoms || ""} placeholder="Symptoms / history" onChange={(event) => setDraft((prev) => ({ ...prev, symptoms: event.target.value }))} />
            <Textarea defaultValue={data?.findings || ""} placeholder="Findings" onChange={(event) => setDraft((prev) => ({ ...prev, findings: event.target.value }))} />
            <Textarea defaultValue={data?.advice || ""} placeholder="Advice" onChange={(event) => setDraft((prev) => ({ ...prev, advice: event.target.value }))} />
            <Textarea defaultValue={data?.followUp || ""} placeholder="Follow up" onChange={(event) => setDraft((prev) => ({ ...prev, followUp: event.target.value }))} />
            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
              <p className="mb-3 text-sm font-semibold">Add Medicine</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Select value={medicineDraft.medicineCatalogId} onValueChange={(value) => setMedicineDraft((prev) => ({ ...prev, medicineCatalogId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                  <SelectContent>
                    {(medicines ?? []).map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} {item.restrictionNote ? `(${item.restrictionNote})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={medicineDraft.customLabel} placeholder="Custom label (optional)" onChange={(event) => setMedicineDraft((prev) => ({ ...prev, customLabel: event.target.value }))} />
                <Input value={medicineDraft.dosageText} placeholder="Dosage" onChange={(event) => setMedicineDraft((prev) => ({ ...prev, dosageText: event.target.value }))} />
                <Input value={medicineDraft.instructions} placeholder="Instructions" onChange={(event) => setMedicineDraft((prev) => ({ ...prev, instructions: event.target.value }))} />
              </div>
              <Button className="mt-3" variant="outline" onClick={addItem}>Add Medicine Row</Button>
            </div>
            <div className="space-y-2">
              {items.map((item: any, index: number) => (
                <div key={`${item.medicineName}-${index}`} className="rounded-lg border border-border/40 bg-background/40 p-3 text-sm">
                  <p className="font-semibold">{item.medicineName}{item.customLabel ? ` (${item.customLabel})` : ""}</p>
                  <p className="text-muted-foreground">{item.dosageText || "No dosage"} · {item.instructions || "No instructions"} · ${item.priceAmount}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => void save()}>Save Prescription</Button>
              <Button variant="outline" onClick={() => void complete()}>Complete Prescription</Button>
            </div>
          </CardContent>
        </Card>
        <PrintVersionsPanel documentType="prescription" documentId={id} />
      </div>
    </DoctorPageShell>
  );
}
