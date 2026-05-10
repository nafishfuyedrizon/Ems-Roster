import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { DoctorPageShell } from "@/pages/doctor-shared";
import { doctorFetch } from "@/lib/doctor-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PrintVersionsPanel } from "@/pages/doctor-components";

const DEFAULT_BLOOD_TEST = [
  "Red blood Cells (RBC)- 4.35 to 5.65(Man),3.92 to 5.13(Women)",
  "White Blood Cells (WBC)- 4500-11000/mm3",
  "Platelets (PLT): 152 to 361",
].join("\n");

const DEFAULT_MRI_TEST = [
  "1. Extensive tissue loss in the right temporal/occipital region",
  "with ex vacuo prominence of the right lateral ventricle and",
  "Wallerian degeneration of the right cerebral peduncle.",
  "2. Subtle focal defects of periventricular white matter probably due",
  "to superimposed small vessel ischemic disease.",
  "3. Previous studies are kept from being made available for review.",
  "At such time that a previous study becomes available,",
  "an addendum will be issued.",
].join("\n");

const DEFAULT_EYE_TEST = "Successfully Read All the Text In This Chart";
const DEFAULT_DESCRIPTION =
  "I have examined and certified that he is free from deafness or any other infirmity, mental or physical, likely to interfere with the efficiency of his work and found to possess good health.";

type MfcDraft = Record<string, string>;

function valueOf(draft: MfcDraft, field: string, fallback = ""): string {
  return draft[field] ?? fallback;
}

function CertificateMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <g fill="none" stroke="#0d6db8" strokeWidth="3">
        <path d="M50 10 58 33 82 18 68 40 92 50 68 60 82 82 58 67 50 90 42 67 18 82 32 60 8 50 32 40 18 18 42 33Z" fill="#9fe3ff" />
        <circle cx="50" cy="50" r="12" fill="#fff" />
      </g>
    </svg>
  );
}

function CertificateHeader() {
  return (
    <div className="px-12 pt-12">
      <div className="border-t border-slate-500 pt-3">
        <div className="grid grid-cols-[60px_minmax(0,1fr)_60px] items-center gap-6 border-b border-slate-500 pb-3">
          <CertificateMark className="h-12 w-12 justify-self-center" />
          <div className="text-center">
            <div className="font-serif text-[28px] font-bold uppercase tracking-[0.18em] text-slate-900">Mount Zonah</div>
            <div className="mt-1 font-serif text-[18px] font-bold uppercase tracking-[0.14em] text-slate-900">Medical Fitness Certificate</div>
          </div>
          <CertificateMark className="h-12 w-12 justify-self-center" />
        </div>
      </div>
    </div>
  );
}

function Paper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="border border-slate-300 bg-[#fffdfa] shadow-[0_18px_60px_rgba(15,23,42,0.18)]">{children}</section>;
}

function InlineField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2 text-[15px] text-slate-900">
      <div className="font-semibold">{label}:</div>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 text-[15px] font-medium text-slate-900 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function PhotoBox({ url }: { url: string }) {
  if (url.trim()) {
    return (
      <div className="h-[240px] w-[180px] overflow-hidden border border-slate-400 bg-white shadow-sm">
        <img src={url} alt="Applicant" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-[240px] w-[180px] items-center justify-center border border-slate-400 bg-white shadow-sm">
      <svg viewBox="0 0 64 64" className="h-24 w-24 text-slate-900" aria-hidden="true">
        <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M20 42V24h24v18H20Zm2-2h20V26H22v14Zm3-3 5-7 4 5 3-3 5 8H25Zm15-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function ReportRow({
  title,
  value,
  result,
  rows,
  onValueChange,
  onResultChange,
}: {
  title: string;
  value: string;
  result: string;
  rows: number;
  onValueChange: (value: string) => void;
  onResultChange: (value: string) => void;
}) {
  return (
    <div className="grid border-b border-slate-500 last:border-b-0 md:grid-cols-[minmax(0,1fr)_116px]">
      <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">
        <div className="mb-1 text-[15px] font-bold text-slate-900">{title}</div>
        <Textarea
          value={value}
          rows={rows}
          onChange={(event) => onValueChange(event.target.value)}
          className="min-h-0 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-[14px] leading-6 text-slate-900 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="flex items-center justify-center p-2">
        <Input
          value={result}
          onChange={(event) => onResultChange(event.target.value)}
          className="h-9 rounded-none border border-emerald-700 bg-[#e8f5df] px-2 text-center text-[13px] font-bold uppercase text-emerald-800 focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

export default function DoctorMfcDetail() {
  const queryClient = useQueryClient();
  const [, params] = useRoute("/doctor/mfc/:id");
  const id = Number(params?.id);
  const { data } = useQuery<any>({
    queryKey: ["doctor-mfc-detail", id],
    queryFn: () => doctorFetch(`/mfc-cases/${id}`),
    enabled: Number.isFinite(id),
  });
  const [draft, setDraft] = useState<MfcDraft>({});

  useEffect(() => {
    if (!data) return;
    setDraft({
      applicantName: data.applicantName ?? "",
      cid: data.cid ?? "",
      sex: data.sex ?? "",
      dateOfBirth: data.dateOfBirth ?? "",
      number: data.number ?? "",
      weight: data.weight ?? "",
      examDateText: data.examDateText ?? "",
      officerName: data.officerName ?? "",
      officerSignature: data.officerSignature ?? "",
      sourceAttachmentUrl: data.sourceAttachmentUrl ?? "",
      mfcReason: data.mfcReason ?? "",
      bloodTest: data.bloodTest || DEFAULT_BLOOD_TEST,
      bloodResult: data.bloodResult || "ALL GOOD",
      mriTest: data.mriTest || DEFAULT_MRI_TEST,
      mriResult: data.mriResult || "ALL GOOD",
      eyeTest: data.eyeTest || DEFAULT_EYE_TEST,
      eyeResult: data.eyeResult || "ALL GOOD",
      finalSummary: data.finalSummary || DEFAULT_DESCRIPTION,
    });
  }, [data]);

  const setField = (field: string, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,920px)_340px] xl:items-start xl:justify-center">
        <div className="space-y-6">
          <Paper>
            <CertificateHeader />
            <div className="px-12 pb-8 pt-4">
              <div className="text-center text-[18px] font-bold text-slate-900">Applicant Information</div>
              <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
                <div className="space-y-3">
                  <InlineField label="Name" value={valueOf(draft, "applicantName")} onChange={(value) => setField("applicantName", value)} />
                  <InlineField label="Sex" value={valueOf(draft, "sex")} onChange={(value) => setField("sex", value)} />
                  <InlineField label="D.O.B" value={valueOf(draft, "dateOfBirth")} onChange={(value) => setField("dateOfBirth", value)} />
                  <InlineField label="CID" value={valueOf(draft, "cid")} onChange={(value) => setField("cid", value)} />
                  <InlineField label="Number" value={valueOf(draft, "number")} onChange={(value) => setField("number", value)} />
                  <InlineField label="Weight" value={valueOf(draft, "weight")} onChange={(value) => setField("weight", value)} />
                  <InlineField label="MFC Reason" value={valueOf(draft, "mfcReason")} onChange={(value) => setField("mfcReason", value)} />
                  <InlineField label="Date" value={valueOf(draft, "examDateText")} onChange={(value) => setField("examDateText", value)} />
                </div>
                <div className="flex justify-center md:justify-end">
                  <PhotoBox url={valueOf(draft, "sourceAttachmentUrl")} />
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-2 text-[18px] font-bold text-slate-900">Test Reports:</div>
                <div className="border border-slate-500">
                  <div className="grid bg-slate-100 text-[15px] font-bold text-[#3b82f6] md:grid-cols-[minmax(0,1fr)_116px]">
                    <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">Report Title</div>
                    <div className="p-2 text-center">Result</div>
                  </div>
                  <ReportRow
                    title="Blood Test:"
                    value={valueOf(draft, "bloodTest")}
                    result={valueOf(draft, "bloodResult")}
                    rows={4}
                    onValueChange={(value) => setField("bloodTest", value)}
                    onResultChange={(value) => setField("bloodResult", value)}
                  />
                  <ReportRow
                    title="MRI Test:"
                    value={valueOf(draft, "mriTest")}
                    result={valueOf(draft, "mriResult")}
                    rows={8}
                    onValueChange={(value) => setField("mriTest", value)}
                    onResultChange={(value) => setField("mriResult", value)}
                  />
                  <ReportRow
                    title="Eye Test:"
                    value={valueOf(draft, "eyeTest")}
                    result={valueOf(draft, "eyeResult")}
                    rows={4}
                    onValueChange={(value) => setField("eyeTest", value)}
                    onResultChange={(value) => setField("eyeResult", value)}
                  />
                </div>
              </div>

              <div className="mt-6 text-[15px] text-slate-900">
                <span className="font-bold text-[#2563eb] underline">Signature of Medical Officer:</span>{" "}
                <Input
                  value={valueOf(draft, "officerSignature")}
                  onChange={(event) => setField("officerSignature", event.target.value)}
                  className="inline-flex h-8 w-[280px] rounded-none border-0 border-b border-slate-300 bg-transparent px-0 align-middle text-[15px] font-medium text-slate-900 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          </Paper>

          <Paper>
            <CertificateHeader />
            <div className="px-12 pb-8 pt-4">
              <div className="text-center text-[18px] font-bold text-slate-900">Applicant Information</div>
              <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
                <div className="space-y-3">
                  <InlineField label="Name" value={valueOf(draft, "applicantName")} onChange={(value) => setField("applicantName", value)} />
                  <InlineField label="Sex" value={valueOf(draft, "sex")} onChange={(value) => setField("sex", value)} />
                  <InlineField label="D.O.B" value={valueOf(draft, "dateOfBirth")} onChange={(value) => setField("dateOfBirth", value)} />
                  <InlineField label="CID" value={valueOf(draft, "cid")} onChange={(value) => setField("cid", value)} />
                  <InlineField label="Number" value={valueOf(draft, "number")} onChange={(value) => setField("number", value)} />
                  <InlineField label="Weight" value={valueOf(draft, "weight")} onChange={(value) => setField("weight", value)} />
                  <InlineField label="MFC Reason" value={valueOf(draft, "mfcReason")} onChange={(value) => setField("mfcReason", value)} />
                  <InlineField label="Date" value={valueOf(draft, "examDateText")} onChange={(value) => setField("examDateText", value)} />
                </div>
                <div className="flex justify-center md:justify-end">
                  <PhotoBox url={valueOf(draft, "sourceAttachmentUrl")} />
                </div>
              </div>

              <div className="mt-8 text-[16px] leading-8 text-slate-900">
                <span className="font-bold">Description:</span>{" "}
                <Textarea
                  value={valueOf(draft, "finalSummary")}
                  rows={5}
                  onChange={(event) => setField("finalSummary", event.target.value)}
                  className="mt-2 min-h-0 resize-none rounded-none border border-slate-300 bg-transparent text-[15px] leading-7 text-slate-900 shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="mt-6 space-y-3 text-[15px] text-slate-900">
                <div>
                  <span className="font-bold text-[#2563eb] underline">Name of Medical Officer:</span>{" "}
                  <Input
                    value={valueOf(draft, "officerName")}
                    onChange={(event) => setField("officerName", event.target.value)}
                    className="inline-flex h-8 w-[280px] rounded-none border-0 border-b border-slate-300 bg-transparent px-0 align-middle text-[15px] font-medium text-slate-900 shadow-none focus-visible:ring-0"
                  />
                </div>
                <div>
                  <span className="font-bold text-[#2563eb] underline">Signature of Medical Officer:</span>{" "}
                  <Input
                    value={valueOf(draft, "officerSignature")}
                    onChange={(event) => setField("officerSignature", event.target.value)}
                    className="inline-flex h-8 w-[280px] rounded-none border-0 border-b border-slate-300 bg-transparent px-0 align-middle text-[15px] font-medium text-slate-900 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
          </Paper>
        </div>

        <Card className="border-border/50 bg-card/50 xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 rounded-[18px] border border-border/60 bg-background/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-muted-foreground">Applicant Photo URL</div>
              <Input
                value={valueOf(draft, "sourceAttachmentUrl")}
                onChange={(event) => setField("sourceAttachmentUrl", event.target.value)}
                placeholder="https://..."
              />
              <div className="text-xs leading-6 text-muted-foreground">Direct image link দিলে certificate-এর photo box আর generated print version-এ ওই photo show করবে.</div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void save()}>Save Changes</Button>
              <Button variant="outline" onClick={() => void complete()}>Complete MFC</Button>
            </div>

            <PrintVersionsPanel documentType="mfc" documentId={id} />
          </CardContent>
        </Card>
      </div>
    </DoctorPageShell>
  );
}
