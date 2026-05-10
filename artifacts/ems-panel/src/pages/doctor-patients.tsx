import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Phone, Search, ShieldPlus, UserRoundSearch } from "lucide-react";
import { Link } from "wouter";
import { DoctorPageShell } from "@/pages/doctor-shared";
import { doctorFetch } from "@/lib/doctor-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MdtSearchResult = {
  characterId: number;
  cid: string;
  dateOfBirth: string | null;
  departmentName: string | null;
  gender: string;
  jobName: string | null;
  licenceIdentifier: string | null;
  mugshot: string | null;
  name: string;
  phone: string | null;
  positionName: string | null;
  workspacePatientId: number | null;
};

type MdtSearchResponse = {
  query: string;
  results: MdtSearchResult[];
};

type MdtCharacterDetail = {
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
  priors: Array<{
    arrestId: number;
    arrestedAt: string | null;
    charges: Array<{
      counts: number | null;
      enhancements: string | null;
      label: string | null;
      name: string | null;
      type: string | null;
    }>;
    fine: number | null;
    incidentId: number;
    plea: string | null;
    time: number | null;
    title: string;
  }>;
  vehicles: Array<{
    id: number | null;
    name: string;
    photo: string | null;
    plate: string | null;
  }>;
};

function formatPatientMeta(label: string, value: string | null | undefined) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "N/A"}</p>
    </div>
  );
}

function getQueryState() {
  if (typeof window === "undefined") {
    return { query: "", characterId: null as number | null };
  }
  const search = new URLSearchParams(window.location.search);
  const rawId = search.get("characterId");
  return {
    query: search.get("q") || "",
    characterId: rawId && /^\d+$/.test(rawId) ? Number(rawId) : null,
  };
}

export default function DoctorPatients() {
  const initial = useMemo(() => getQueryState(), []);
  const [query, setQuery] = useState(initial.query);
  const deferredQuery = useDeferredValue(query.trim());
  const openCharacterId = initial.characterId;

  const { data: searchData, isFetching } = useQuery<MdtSearchResponse>({
    queryKey: ["doctor-mdt-search", deferredQuery],
    queryFn: () => doctorFetch(`/mdt/characters/search?q=${encodeURIComponent(deferredQuery)}`),
    enabled: !openCharacterId && deferredQuery.length >= 1,
  });

  const { data: selectedDetail, isFetching: isFetchingDetail } = useQuery<MdtCharacterDetail>({
    queryKey: ["doctor-mdt-character-detail", openCharacterId],
    queryFn: () => doctorFetch(`/mdt/characters/${openCharacterId}`),
    enabled: Number.isFinite(openCharacterId) && openCharacterId !== null,
  });

  const searchResults = searchData?.results ?? [];

  const openResult = (characterId: number) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("characterId", String(characterId));
    window.location.href = `/doctor/patients?${params.toString()}`;
  };

  const backToResultsHref = query.trim() ? `/doctor/patients?q=${encodeURIComponent(query.trim())}` : "/doctor/patients";

  return (
    <DoctorPageShell>
      {openCharacterId ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold uppercase tracking-tight">Patient Profile</h2>
              <p className="mt-1 font-mono text-sm text-muted-foreground">Full MDT profile view</p>
            </div>
            <Button asChild variant="outline">
              <Link href={backToResultsHref}>
                <ArrowLeft className="h-4 w-4" />
                Back to results
              </Link>
            </Button>
          </div>

          {isFetchingDetail || !selectedDetail ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6 text-sm text-muted-foreground">Loading full MDT profile...</CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-28 w-28 overflow-hidden rounded-2xl border border-border/50 bg-background/40">
                        {selectedDetail.mugshot ? (
                          <img src={selectedDetail.mugshot} alt={selectedDetail.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <UserRoundSearch className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-foreground">{selectedDetail.name}</h3>
                          <Badge variant="outline">CID {selectedDetail.cid}</Badge>
                          <Badge variant="secondary">{selectedDetail.gender}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Full citizen profile from Legacy MDT. Search result click korle only এই profile open হবে.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
                <Card className="border-border/40 bg-background/30">
                  <CardHeader>
                    <CardTitle>Identity</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {formatPatientMeta("Phone", selectedDetail.phone)}
                    {formatPatientMeta("Date of Birth", selectedDetail.dateOfBirth)}
                    {formatPatientMeta("Department", selectedDetail.departmentName || selectedDetail.jobName)}
                    {formatPatientMeta("Position", selectedDetail.positionName)}
                    {formatPatientMeta("License", selectedDetail.licenceIdentifier)}
                    {formatPatientMeta("Source", "Legacy MDT")}
                  </CardContent>
                </Card>

                <Card className="border-border/40 bg-background/30">
                  <CardHeader>
                    <CardTitle>Cars</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedDetail.vehicles.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedDetail.vehicles.map((vehicle, index) => (
                          <Badge key={`${vehicle.plate || vehicle.name}-${index}`} variant="secondary" className="px-3 py-1 text-xs">
                            {vehicle.name}
                            {vehicle.plate ? ` (${vehicle.plate})` : ""}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No vehicle data available from the current MDT source.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/40 bg-background/30">
                <CardHeader>
                  <CardTitle>Police Record History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedDetail.priors.length ? (
                    selectedDetail.priors.map((prior) => (
                      <div key={prior.arrestId} className="rounded-xl border border-border/40 bg-background/40 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{prior.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {prior.arrestedAt || "Unknown date"} · {prior.plea || "Unknown plea"}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {prior.time ?? 0} months · ${prior.fine ?? 0}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {prior.charges.map((charge, index) => (
                            <Badge
                              key={`${prior.arrestId}-${charge.label || charge.name || index}`}
                              variant={charge.type === "Misdemeanor" ? "secondary" : "destructive"}
                              className="max-w-full whitespace-normal text-left text-[11px]"
                            >
                              {charge.name || charge.label || "Charge"}
                              {charge.counts ? ` x${charge.counts}` : ""}
                              {charge.enhancements ? ` (${charge.enhancements})` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No police record history was returned for this citizen.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold uppercase tracking-tight">Patients</h2>
            <p className="mt-1 font-mono text-sm text-muted-foreground">CID or name search first, then open full profile</p>
          </div>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">MDT Live Search</p>
                  <CardTitle className="mt-2">CID / name result card</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">CID বা name লিখে আগে শুধু result list দেখাবে. Result click করলে full profile open হবে.</p>
                </div>
                <div className="rounded-full border border-primary/30 bg-primary/10 p-2 text-primary">
                  <Search className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type CID or name..."
                  className="pl-9"
                />
              </div>

              {deferredQuery.length < 1 ? (
                <div className="rounded-xl border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
                  Search শুরু করলে এখানেই matching result list দেখাবে।
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
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.characterId}
                      type="button"
                      onClick={() => openResult(result.characterId)}
                      className="w-full rounded-xl border border-border/40 bg-background/30 p-4 text-left transition hover:border-primary/40 hover:bg-background/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{result.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">CID {result.cid} · {result.phone || "No phone"}</p>
                        </div>
                        {result.workspacePatientId ? <Badge variant="secondary">Linked</Badge> : <Badge variant="outline">MDT Only</Badge>}
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {result.departmentName || result.jobName || "No department"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ShieldPlus className="h-3.5 w-3.5" />
                          {result.positionName || "No position"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {result.phone || "No phone"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DoctorPageShell>
  );
}
