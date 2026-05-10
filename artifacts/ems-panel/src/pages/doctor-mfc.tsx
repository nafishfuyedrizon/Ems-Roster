import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { doctorFetch } from "@/lib/doctor-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function cleanField(value: string) {
  return value.replace(/\*\*/g, "").trim();
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

export default function DoctorMfc() {
  const queryClient = useQueryClient();
  const { data } = useDoctorQuery<any[]>("doctor-mfc", "/mfc-cases");
  const [form, setForm] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

  const defaults = useMemo(() => ({
    appointmentId: cleanField(search?.get("appointmentId") || ""),
    applicantName: cleanField(search?.get("applicantName") || ""),
    cid: cleanField(search?.get("cid") || ""),
    sex: cleanField(search?.get("sex") || ""),
    dateOfBirth: cleanField(search?.get("dateOfBirth") || ""),
    number: cleanField(search?.get("number") || ""),
  }), [search]);

  const values = {
    applicantName: form.applicantName ?? defaults.applicantName,
    cid: form.cid ?? defaults.cid,
    sex: form.sex ?? defaults.sex,
    dateOfBirth: form.dateOfBirth ?? defaults.dateOfBirth,
    number: form.number ?? defaults.number,
    mfcReason: form.mfcReason ?? "",
  };

  const create = async () => {
    try {
      setCreating(true);
      setCreateError("");
      const payload = {
        appointmentId: /^\d+$/.test(defaults.appointmentId) ? Number(defaults.appointmentId) : undefined,
        applicantName: cleanField(values.applicantName) || "Unknown",
        cid: cleanField(values.cid),
        sex: cleanField(values.sex),
        dateOfBirth: cleanField(values.dateOfBirth),
        number: cleanField(values.number),
        mfcReason: cleanField(values.mfcReason),
        examDateText: todayText(),
      };
      const response = await doctorFetch<{ id: number }>("/mfc-cases", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await queryClient.invalidateQueries({ queryKey: ["doctor-mfc"] });
      window.location.href = `/doctor/mfc/${response.id}`;
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create MFC draft.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DoctorPageShell>
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle>Create MFC Case</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={values.applicantName} placeholder="Applicant name" onChange={(event) => setForm((prev) => ({ ...prev, applicantName: event.target.value }))} />
            <Input value={values.cid} placeholder="CID" onChange={(event) => setForm((prev) => ({ ...prev, cid: event.target.value }))} />
            <Input value={values.sex} placeholder="Sex" onChange={(event) => setForm((prev) => ({ ...prev, sex: event.target.value }))} />
            <Input value={values.dateOfBirth} placeholder="DOB" onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))} />
            <Input value={values.number} placeholder="Number" onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))} />
            <Input value={values.mfcReason} placeholder="MFC Reason" onChange={(event) => setForm((prev) => ({ ...prev, mfcReason: event.target.value }))} />
            {createError ? (
              <Alert variant="destructive">
                <AlertTitle>Create Draft failed</AlertTitle>
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="button" onClick={() => void create()} className="w-full" disabled={creating}>
              {creating ? "Creating..." : "Create Draft"}
            </Button>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          {(data ?? []).map((item) => (
            <Card key={item.id} className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>{item.applicantName}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>CID: {item.cid || "N/A"}</p>
                  <p>Status: {item.status}</p>
                </div>
                <Link href={`/doctor/mfc/${item.id}`} className="text-primary underline">Open</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
