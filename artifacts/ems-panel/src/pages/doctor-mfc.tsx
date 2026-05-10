import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { doctorFetch } from "@/lib/doctor-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Phone, Search, UserRoundSearch } from "lucide-react";

function cleanField(value: string) {
  return value.replace(/\*\*/g, "").trim();
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

type MdtSearchResult = {
  characterId: number;
  cid: string;
  dateOfBirth: string | null;
  gender: string;
  mugshot: string | null;
  name: string;
  phone: string | null;
};

type MdtSearchResponse = {
  query: string;
  results: MdtSearchResult[];
};

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

  const lookupText = (form.cid ?? defaults.cid ?? form.applicantName ?? defaults.applicantName ?? "").trim();
  const deferredLookup = useDeferredValue(lookupText);
  const { data: mdtSearch, isFetching: isFetchingLookup } = useQuery<MdtSearchResponse>({
    queryKey: ["doctor-mfc-mdt-search", deferredLookup],
    queryFn: () => doctorFetch(`/mdt/characters/search?q=${encodeURIComponent(deferredLookup)}`),
    enabled: deferredLookup.length >= 1,
  });

  const values = {
    applicantName: form.applicantName ?? defaults.applicantName,
    cid: form.cid ?? defaults.cid,
    sex: form.sex ?? defaults.sex,
    dateOfBirth: form.dateOfBirth ?? defaults.dateOfBirth,
    number: form.number ?? defaults.number,
    mfcReason: form.mfcReason ?? "",
    sourceAttachmentUrl: form.sourceAttachmentUrl ?? "",
  };

  const draftCases = useMemo(
    () => (data ?? []).filter((item) => item.status !== "completed"),
    [data],
  );

  const autofillFromMdt = (result: MdtSearchResult) => {
    setForm((prev) => ({
      ...prev,
      applicantName: result.name,
      cid: result.cid,
      sex: result.gender,
      dateOfBirth: result.dateOfBirth ?? "",
      number: result.phone ?? "",
      sourceAttachmentUrl: result.mugshot ?? prev.sourceAttachmentUrl ?? "",
    }));
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
        sourceAttachmentUrl: cleanField(values.sourceAttachmentUrl),
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
            {deferredLookup.length >= 1 ? (
              <div className="rounded-xl border border-border/50 bg-background/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary">
                    <Search className="h-3.5 w-3.5" />
                    MDT Auto Fill
                  </div>
                  {isFetchingLookup ? <span className="text-xs text-muted-foreground">Searching...</span> : null}
                </div>
                {mdtSearch?.results?.length ? (
                  <div className="space-y-2">
                    {mdtSearch.results.slice(0, 5).map((result) => (
                      <button
                        key={result.characterId}
                        type="button"
                        onClick={() => autofillFromMdt(result)}
                        className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-3 text-left transition hover:border-primary/40 hover:bg-background/60"
                      >
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-background/50">
                          {result.mugshot ? (
                            <img src={result.mugshot} alt={result.name} className="h-full w-full object-cover" />
                          ) : (
                            <UserRoundSearch className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-foreground">{result.name}</p>
                            <Badge variant="outline">CID {result.cid}</Badge>
                            <Badge variant="secondary">{result.gender}</Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>DOB {result.dateOfBirth || "N/A"}</span>
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {result.phone || "No phone"}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : !isFetchingLookup ? (
                  <p className="text-sm text-muted-foreground">No MDT character matched this name or CID.</p>
                ) : null}
              </div>
            ) : null}
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
          {draftCases.map((item) => (
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
          {!draftCases.length ? (
            <Card className="border-border/50 bg-card/40">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No draft MFC cases remain here. Confirmed MFC certificates now appear in Medical Records.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </DoctorPageShell>
  );
}
