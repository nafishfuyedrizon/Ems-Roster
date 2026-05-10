import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { doctorFetch } from "@/lib/doctor-api";

export default function DoctorPrescriptions() {
  const queryClient = useQueryClient();
  const { data } = useDoctorQuery<any[]>("doctor-prescriptions", "/prescriptions");
  const [form, setForm] = useState<Record<string, string>>({});
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const defaults = useMemo(() => ({
    appointmentId: search?.get("appointmentId") || "",
    patientName: search?.get("applicantName") || "",
    cid: search?.get("cid") || "",
    sex: search?.get("sex") || "",
    number: search?.get("number") || "",
  }), [search]);

  const create = async () => {
    const response = await doctorFetch<{ id: number }>("/prescriptions", {
      method: "POST",
      body: JSON.stringify({ ...defaults, ...form, items: [] }),
    });
    await queryClient.invalidateQueries({ queryKey: ["doctor-prescriptions"] });
    window.location.href = `/doctor/prescriptions/${response.id}`;
  };

  return (
    <DoctorPageShell>
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle>Create Prescription</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input defaultValue={defaults.patientName} placeholder="Patient name" onChange={(event) => setForm((prev) => ({ ...prev, patientName: event.target.value }))} />
            <Input defaultValue={defaults.cid} placeholder="CID" onChange={(event) => setForm((prev) => ({ ...prev, cid: event.target.value }))} />
            <Input placeholder="Age" onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))} />
            <Input defaultValue={defaults.sex} placeholder="Sex" onChange={(event) => setForm((prev) => ({ ...prev, sex: event.target.value }))} />
            <Input placeholder="Weight" onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))} />
            <Button onClick={() => void create()} className="w-full">Create Draft</Button>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          {(data ?? []).map((item) => (
            <Card key={item.id} className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>{item.patientName}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>CID: {item.cid || "N/A"}</p>
                  <p>Status: {item.status}</p>
                </div>
                <Link href={`/doctor/prescriptions/${item.id}`} className="text-primary underline">Open</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
