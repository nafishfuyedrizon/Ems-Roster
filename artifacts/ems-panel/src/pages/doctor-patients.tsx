import { type ReactNode, useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ClipboardList, FileText, Search, ShieldPlus, UserRoundSearch } from "lucide-react";
import { DoctorPageShell, useDoctorQuery } from "@/pages/doctor-shared";
import { doctorFetch } from "@/lib/doctor-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TimelineItem = {
  id: number;
  occurredAt: string | null;
  status: string;
  title: string;
  type: "appointment" | "medical-record" | "mfc" | "prescription";
};

type PatientCard = {
  id: number;
  cid: string | null;
  createdAt: string;
  dateOfBirth: string | null;
  latestActivity: TimelineItem | null;
  name: string;
  notes: string | null;
  phone: string | null;
  requiresReview: boolean;
  sex: string | null;
  stats: {
    appointments: number;
    medicalRecords: number;
    mfcCases: number;
    prescriptions: number;
  };
  timelinePreview: TimelineItem[];
  updatedAt: string;
  weight: string | null;
};

type PatientSearchResponse = {
  query: string;
  results: PatientCard[];
};

function formatPatientMeta(label: string, value: string | null | undefined) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "N/A"}</p>
    </div>
  );
}

function metricCard(label: string, value: number, icon: ReactNode) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
        <div className="text-primary">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function DoctorPatients() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data } = useDoctorQuery<any[]>("doctor-patients", "/patients");
  const { data: searchData, isFetching } = useQuery<PatientSearchResponse>({
    queryKey: ["doctor-patient-search", deferredQuery],
    queryFn: () => doctorFetch(`/patients/search?q=${encodeURIComponent(deferredQuery)}`),
    enabled: deferredQuery.length >= 2,
  });

  const searchResults = searchData?.results ?? [];

  useEffect(() => {
    if (!searchResults.length) {
      setSelectedId(null);
      return;
    }
    if (!searchResults.some((result) => result.id === selectedId)) {
      setSelectedId(searchResults[0].id);
    }
  }, [searchResults, selectedId]);

  const selectedResult = searchResults.find((result) => result.id === selectedId) ?? searchResults[0] ?? null;

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Patients</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Patient master list linked by CID with quick search result cards</p>
        </div>
        <Card className="overflow-hidden border-border/50 bg-card/50">
          <div className="grid gap-0 xl:grid-cols-[360px,1fr]">
            <div className="border-b border-border/50 bg-background/40 p-5 xl:border-b-0 xl:border-r">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">CID / Name Search</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">Quick patient lookup</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Search by CID, name, or phone to surface a doctor-ready summary card.</p>
                </div>
                <div className="rounded-full border border-primary/30 bg-primary/10 p-2 text-primary">
                  <UserRoundSearch className="h-5 w-5" />
                </div>
              </div>
              <div className="relative mt-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type CID, name, or phone..."
                  className="pl-9"
                />
              </div>
              <div className="mt-4 space-y-2">
                {deferredQuery.length < 2 ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
                    Enter at least 2 characters to open the result card.
                  </div>
                ) : isFetching ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
                    Searching patient workspace...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
                    No patient matched this query yet.
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => setSelectedId(result.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selectedId === result.id
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                          : "border-border/40 bg-background/30 hover:border-primary/30 hover:bg-background/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{result.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">CID {result.cid || "N/A"} · {result.phone || "No phone"}</p>
                        </div>
                        {result.requiresReview ? <Badge variant="destructive">Needs Review</Badge> : <Badge variant="secondary">Ready</Badge>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>{result.stats.appointments} appointments</span>
                        <span>{result.stats.medicalRecords} records</span>
                        <span>{result.stats.mfcCases} MFC</span>
                        <span>{result.stats.prescriptions} Rx</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="p-5">
              {selectedResult ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 border-b border-border/50 pb-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold text-foreground">{selectedResult.name}</h3>
                        <Badge variant="outline">CID {selectedResult.cid || "N/A"}</Badge>
                        {selectedResult.sex ? <Badge variant="secondary">{selectedResult.sex}</Badge> : null}
                      </div>
                      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Search result card focused on immediate doctor context, recent activity, and a fast jump into the full patient timeline.
                      </p>
                    </div>
                    <Button asChild className="md:self-start">
                      <Link href={`/doctor/patients/${selectedResult.id}`}>Open full patient timeline</Link>
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metricCard("Appointments", selectedResult.stats.appointments, <ClipboardList className="h-4 w-4" />)}
                    {metricCard("Medical Records", selectedResult.stats.medicalRecords, <Activity className="h-4 w-4" />)}
                    {metricCard("MFC Cases", selectedResult.stats.mfcCases, <ShieldPlus className="h-4 w-4" />)}
                    {metricCard("Prescriptions", selectedResult.stats.prescriptions, <FileText className="h-4 w-4" />)}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-border/40 bg-background/30">
                      <CardHeader>
                        <CardTitle>Identity Snapshot</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        {formatPatientMeta("Phone", selectedResult.phone)}
                        {formatPatientMeta("Date of Birth", selectedResult.dateOfBirth)}
                        {formatPatientMeta("Weight", selectedResult.weight)}
                        {formatPatientMeta("Updated", new Date(selectedResult.updatedAt).toLocaleString())}
                      </CardContent>
                    </Card>

                    <Card className="border-border/40 bg-background/30">
                      <CardHeader>
                        <CardTitle>Latest Activity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedResult.latestActivity ? (
                          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                            <p className="font-semibold capitalize text-foreground">{selectedResult.latestActivity.type.replace("-", " ")}</p>
                            <p className="mt-1 text-sm text-foreground">{selectedResult.latestActivity.title}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {selectedResult.latestActivity.occurredAt || "Unknown date"} · {selectedResult.latestActivity.status}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No recorded activity yet for this patient.</p>
                        )}
                        {selectedResult.notes ? (
                          <div className="rounded-xl border border-border/40 bg-background/40 p-4">
                            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Notes</p>
                            <p className="mt-2 text-sm text-foreground">{selectedResult.notes}</p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-border/40 bg-background/30">
                    <CardHeader>
                      <CardTitle>Timeline Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedResult.timelinePreview.length > 0 ? (
                        selectedResult.timelinePreview.map((item) => (
                          <div key={`${item.type}-${item.id}`} className="rounded-xl border border-border/40 bg-background/40 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold capitalize text-foreground">{item.type.replace("-", " ")}</p>
                                <p className="mt-1 text-sm text-foreground">{item.title}</p>
                              </div>
                              <Badge variant="outline">{item.status}</Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{item.occurredAt || "Unknown date"}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Timeline preview will appear here as soon as imported doctor data lands for this CID.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border/50 bg-background/20 p-8 text-center">
                  <div className="max-w-md space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <Search className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">Search result card is ready</h3>
                    <p className="text-sm text-muted-foreground">
                      Start with a CID, patient name, or phone number and the doctor-focused result card will open here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
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
