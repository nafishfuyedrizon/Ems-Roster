import { type ReactNode, useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, Building2, FileText, Phone, Search, ShieldPlus, UserRoundSearch } from "lucide-react";
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

type WorkspacePatientCard = {
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

type MdtSearchResult = {
  characterId: number;
  cid: string;
  dateOfBirth: string | null;
  departmentName: string | null;
  firstName: string;
  gender: string;
  jobName: string | null;
  licenceIdentifier: string | null;
  mugshot: string | null;
  name: string;
  phone: string | null;
  positionName: string | null;
  workspaceCard: WorkspacePatientCard | null;
  workspacePatientId: number | null;
};

type MdtSearchResponse = {
  query: string;
  results: MdtSearchResult[];
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

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function DoctorPatients() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  const { data: localPatients } = useDoctorQuery<any[]>("doctor-patients", "/patients");
  const { data: searchData, isFetching } = useQuery<MdtSearchResponse>({
    queryKey: ["doctor-mdt-search", deferredQuery],
    queryFn: () => doctorFetch(`/mdt/characters/search?q=${encodeURIComponent(deferredQuery)}`),
    enabled: deferredQuery.length >= 1,
  });

  const searchResults = searchData?.results ?? [];

  useEffect(() => {
    if (!searchResults.length) {
      setSelectedCharacterId(null);
      return;
    }
    if (!searchResults.some((result) => result.characterId === selectedCharacterId)) {
      setSelectedCharacterId(searchResults[0].characterId);
    }
  }, [searchResults, selectedCharacterId]);

  const selectedResult =
    searchResults.find((result) => result.characterId === selectedCharacterId) ?? searchResults[0] ?? null;
  const linkedWorkspace = selectedResult?.workspaceCard ?? null;

  return (
    <DoctorPageShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Patients</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">Live MDT CID or name search with doctor workspace linking</p>
        </div>
        <Card className="overflow-hidden border-border/50 bg-card/50">
          <div className="grid gap-0 xl:grid-cols-[360px,1fr]">
            <div className="border-b border-border/50 bg-background/40 p-5 xl:border-b-0 xl:border-r">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">MDT Live Search</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">CID / name result card</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Search Legacy MDT by CID, name, or phone and open the result instantly.</p>
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
                {deferredQuery.length < 1 ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
                    Start typing any CID or name to open the MDT result card.
                  </div>
                ) : isFetching ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
                    Searching live MDT characters...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
                    No MDT citizen matched this query yet.
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.characterId}
                      type="button"
                      onClick={() => setSelectedCharacterId(result.characterId)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selectedCharacterId === result.characterId
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(0,229,255,0.18)]"
                          : "border-border/40 bg-background/30 hover:border-primary/30 hover:bg-background/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{result.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">CID {result.cid} · {result.phone || "No phone"}</p>
                        </div>
                        {result.workspacePatientId ? <Badge variant="secondary">Linked</Badge> : <Badge variant="outline">MDT Only</Badge>}
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>{result.departmentName || result.jobName || "No department"}</p>
                        <p>{result.positionName || "No position"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="p-5">
              {selectedResult ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 border-b border-border/50 pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-24 w-24 overflow-hidden rounded-2xl border border-border/50 bg-background/40">
                        {selectedResult.mugshot ? (
                          <img src={selectedResult.mugshot} alt={selectedResult.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <UserRoundSearch className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-foreground">{selectedResult.name}</h3>
                          <Badge variant="outline">CID {selectedResult.cid}</Badge>
                          <Badge variant="secondary">{selectedResult.gender}</Badge>
                          {selectedResult.workspacePatientId ? <Badge>Workspace Linked</Badge> : <Badge variant="outline">MDT Source</Badge>}
                        </div>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                          Real MDT result card with live citizen identity, department information, and optional doctor workspace link when this CID already exists locally.
                        </p>
                      </div>
                    </div>
                    {selectedResult.workspacePatientId ? (
                      <Button asChild className="lg:self-start">
                        <Link href={`/doctor/patients/${selectedResult.workspacePatientId}`}>Open full patient timeline</Link>
                      </Button>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/50 bg-background/30 px-4 py-3 text-sm text-muted-foreground lg:self-start">
                        Not linked to doctor workspace yet
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
                    <Card className="border-border/40 bg-background/30">
                      <CardHeader>
                        <CardTitle>MDT Identity Snapshot</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        {formatPatientMeta("Phone", selectedResult.phone)}
                        {formatPatientMeta("Date of Birth", selectedResult.dateOfBirth)}
                        {formatPatientMeta("Department", selectedResult.departmentName || selectedResult.jobName)}
                        {formatPatientMeta("Position", selectedResult.positionName)}
                        {formatPatientMeta("License", selectedResult.licenceIdentifier)}
                        {formatPatientMeta("Source", "Legacy MDT")}
                      </CardContent>
                    </Card>

                    <Card className="border-border/40 bg-background/30">
                      <CardHeader>
                        <CardTitle>Workspace Link Status</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                          <p className="font-semibold text-foreground">
                            {selectedResult.workspacePatientId ? "This CID is already linked." : "This CID is not linked yet."}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {selectedResult.workspacePatientId
                              ? "Doctor timeline data is available below from the local workspace."
                              : "You can already see the MDT profile card here even before importing this citizen into the doctor workspace."}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-background/40 p-4">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span>{selectedResult.departmentName || selectedResult.jobName || "No department assigned"}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                            <Phone className="h-4 w-4 text-primary" />
                            <span>{selectedResult.phone || "No phone listed"}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {linkedWorkspace ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {metricCard("Appointments", linkedWorkspace.stats.appointments, <Activity className="h-4 w-4" />)}
                        {metricCard("Medical Records", linkedWorkspace.stats.medicalRecords, <Activity className="h-4 w-4" />)}
                        {metricCard("MFC Cases", linkedWorkspace.stats.mfcCases, <ShieldPlus className="h-4 w-4" />)}
                        {metricCard("Prescriptions", linkedWorkspace.stats.prescriptions, <FileText className="h-4 w-4" />)}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="border-border/40 bg-background/30">
                          <CardHeader>
                            <CardTitle>Local Patient Overview</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-4 sm:grid-cols-2">
                            {formatPatientMeta("Workspace Name", linkedWorkspace.name)}
                            {formatPatientMeta("Workspace Phone", linkedWorkspace.phone)}
                            {formatPatientMeta("Sex", linkedWorkspace.sex)}
                            {formatPatientMeta("Updated", formatDate(linkedWorkspace.updatedAt))}
                          </CardContent>
                        </Card>

                        <Card className="border-border/40 bg-background/30">
                          <CardHeader>
                            <CardTitle>Latest Workspace Activity</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {linkedWorkspace.latestActivity ? (
                              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                                <p className="font-semibold capitalize text-foreground">
                                  {linkedWorkspace.latestActivity.type.replace("-", " ")}
                                </p>
                                <p className="mt-1 text-sm text-foreground">{linkedWorkspace.latestActivity.title}</p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {linkedWorkspace.latestActivity.occurredAt || "Unknown date"} · {linkedWorkspace.latestActivity.status}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No recorded doctor workspace activity yet.</p>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border-border/40 bg-background/30">
                        <CardHeader>
                          <CardTitle>Timeline Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {linkedWorkspace.timelinePreview.length > 0 ? (
                            linkedWorkspace.timelinePreview.map((item) => (
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
                            <p className="text-sm text-muted-foreground">This linked patient does not have doctor timeline events yet.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border/50 bg-background/20 p-8 text-center">
                  <div className="max-w-md space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <Search className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">Search result card is ready</h3>
                    <p className="text-sm text-muted-foreground">
                      Start with any MDT CID, patient name, or phone number and the live result card will open here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(localPatients ?? []).map((patient) => (
            <Card key={patient.id} className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>{patient.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">CID: {patient.cid || "N/A"}</p>
                <p className="text-muted-foreground">Phone: {patient.phone || "N/A"}</p>
                <Link href={`/doctor/patients/${patient.id}`} className="text-primary underline">
                  Open patient timeline
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DoctorPageShell>
  );
}
