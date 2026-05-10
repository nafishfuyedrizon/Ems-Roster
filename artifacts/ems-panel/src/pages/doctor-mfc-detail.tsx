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

function certificateValue(draft: MfcDraft, field: string, fallback = ""): string {
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

function PhotoPreview({ url }: { url: string }) {
  if (url.trim()) {
    return (
      <div className="overflow-hidden rounded-[22px] border border-slate-300 bg-white shadow-sm">
        <img src={url} alt="Applicant preview" className="h-[230px] w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-[230px] items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <svg viewBox="0 0 64 64" className="h-20 w-20" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M20 42V24h24v18H20Zm2-2h20V26H22v14Zm3-3 5-7 4 5 3-3 5 8H25Zm15-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor" />
        </svg>
        <div className="text-sm font-medium">Applicant photo option ready</div>
      </div>
    </div>
  );
}

function CertificateField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 text-[15px] font-medium text-slate-800 shadow-none focus-visible:ring-0"
      />
    </label>
  );
}

function CertificateTextarea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">{label}</span>
      <Textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-0 resize-y rounded-none border-slate-300 bg-transparent text-[14px] leading-7 text-slate-800 focus-visible:ring-0"
      />
    </label>
  );
}

function ReportRow({
  title,
  body,
  result,
  onBodyChange,
  onResultChange,
}: {
  title: string;
  body: string;
  result: string;
  onBodyChange: (value: string) => void;
  onResultChange: (value: string) => void;
}) {
  return (
    <div className="grid border-b border-slate-300 md:grid-cols-[minmax(0,1fr)_180px]">
      <div className="border-b border-slate-300 p-4 md:border-b-0 md:border-r">
        <div className="mb-2 text-sm font-semibold text-slate-800">{title}</div>
        <Textarea
          value={body}
          rows={title === "MRI Test:" ? 8 : 4}
          onChange={(event) => onBodyChange(event.target.value)}
          className="min-h-0 resize-y rounded-none border-0 bg-transparent px-0 text-[14px] leading-7 text-slate-700 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="flex items-center justify-center p-4">
        <Input
          value={result}
          onChange={(event) => onResultChange(event.target.value)}
          className="h-12 rounded-none border-slate-300 text-center text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700 focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

function PaperSection({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-300 bg-[#fffdf8] shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
      <div className="border-b border-slate-200 px-8 py-7">
        <div className="grid items-center gap-6 md:grid-cols-[72px_minmax(0,1fr)_72px]">
          <CertificateMark className="mx-auto h-16 w-16" />
          <div className="text-center">
            <div className="text-[34px] font-black uppercase tracking-[0.22em] text-slate-900">MOUNT ZONAH</div>
            <div className="mt-2 text-[26px] font-bold uppercase tracking-[0.18em] text-slate-800">Medical Fitness Certificate</div>
          </div>
          <CertificateMark className="mx-auto h-16 w-16" />
        </div>
        {title ? <div className="mt-6 text-left text-[18px] font-semibold text-slate-900">{title}</div> : null}
        {subtitle ? <div className="mt-2 text-left text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="p-8">{children}</div>
    </section>
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <PaperSection title="Applicant Information" subtitle="Logo, design, and applicant photo are now part of the editable certificate layout.">
            <div className="grid gap-6">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="grid gap-5">
                  <CertificateField label="Name" value={certificateValue(draft, "applicantName")} onChange={(value) => setField("applicantName", value)} />
                  <CertificateField label="Sex" value={certificateValue(draft, "sex")} onChange={(value) => setField("sex", value)} />
                  <CertificateField label="D.O.B" value={certificateValue(draft, "dateOfBirth")} onChange={(value) => setField("dateOfBirth", value)} />
                  <CertificateField label="CID" value={certificateValue(draft, "cid")} onChange={(value) => setField("cid", value)} />
                  <CertificateField label="Number" value={certificateValue(draft, "number")} onChange={(value) => setField("number", value)} />
                  <CertificateField label="Weight" value={certificateValue(draft, "weight")} onChange={(value) => setField("weight", value)} />
                  <CertificateField label="MFC Reason" value={certificateValue(draft, "mfcReason")} onChange={(value) => setField("mfcReason", value)} />
                  <CertificateField label="Date" value={certificateValue(draft, "examDateText")} onChange={(value) => setField("examDateText", value)} />
                </div>

                <div className="grid gap-4">
                  <PhotoPreview url={certificateValue(draft, "sourceAttachmentUrl")} />
                  <CertificateField
                    label="Applicant Photo URL"
                    value={certificateValue(draft, "sourceAttachmentUrl")}
                    onChange={(value) => setField("sourceAttachmentUrl", value)}
                  />
                  <p className="text-xs leading-6 text-slate-500">
                    Direct image link দিলে certificate-এর photo box-এ preview আর generated print version-এও ওই ছবি যাবে।
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[18px] border border-slate-300">
                <div className="grid border-b border-slate-300 bg-slate-100 text-sm font-semibold text-slate-700 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="border-b border-slate-300 p-4 md:border-b-0 md:border-r">Report Title</div>
                  <div className="p-4 text-center">Result</div>
                </div>
                <ReportRow
                  title="Blood Test:"
                  body={certificateValue(draft, "bloodTest")}
                  result={certificateValue(draft, "bloodResult")}
                  onBodyChange={(value) => setField("bloodTest", value)}
                  onResultChange={(value) => setField("bloodResult", value)}
                />
                <ReportRow
                  title="MRI Test:"
                  body={certificateValue(draft, "mriTest")}
                  result={certificateValue(draft, "mriResult")}
                  onBodyChange={(value) => setField("mriTest", value)}
                  onResultChange={(value) => setField("mriResult", value)}
                />
                <ReportRow
                  title="Eye Test:"
                  body={certificateValue(draft, "eyeTest")}
                  result={certificateValue(draft, "eyeResult")}
                  onBodyChange={(value) => setField("eyeTest", value)}
                  onResultChange={(value) => setField("eyeResult", value)}
                />
              </div>

              <CertificateField
                label="Signature of Medical Officer"
                value={certificateValue(draft, "officerSignature")}
                onChange={(value) => setField("officerSignature", value)}
              />
            </div>
          </PaperSection>

          <PaperSection title="Applicant Information">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="grid gap-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <CertificateField label="Name" value={certificateValue(draft, "applicantName")} onChange={(value) => setField("applicantName", value)} />
                  <CertificateField label="CID" value={certificateValue(draft, "cid")} onChange={(value) => setField("cid", value)} />
                  <CertificateField label="Sex" value={certificateValue(draft, "sex")} onChange={(value) => setField("sex", value)} />
                  <CertificateField label="D.O.B" value={certificateValue(draft, "dateOfBirth")} onChange={(value) => setField("dateOfBirth", value)} />
                  <CertificateField label="Number" value={certificateValue(draft, "number")} onChange={(value) => setField("number", value)} />
                  <CertificateField label="Weight" value={certificateValue(draft, "weight")} onChange={(value) => setField("weight", value)} />
                  <CertificateField label="MFC Reason" value={certificateValue(draft, "mfcReason")} onChange={(value) => setField("mfcReason", value)} className="md:col-span-2" />
                  <CertificateField label="Date" value={certificateValue(draft, "examDateText")} onChange={(value) => setField("examDateText", value)} className="md:col-span-2" />
                </div>

                <CertificateTextarea
                  label="Description"
                  rows={5}
                  value={certificateValue(draft, "finalSummary")}
                  onChange={(value) => setField("finalSummary", value)}
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <CertificateField label="Name of Medical Officer" value={certificateValue(draft, "officerName")} onChange={(value) => setField("officerName", value)} />
                  <CertificateField
                    label="Signature of Medical Officer"
                    value={certificateValue(draft, "officerSignature")}
                    onChange={(value) => setField("officerSignature", value)}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void save()}>Save Changes</Button>
                  <Button variant="outline" onClick={() => void complete()}>Complete MFC</Button>
                </div>
              </div>

              <div className="grid gap-4">
                <PhotoPreview url={certificateValue(draft, "sourceAttachmentUrl")} />
                <div className="rounded-[18px] border border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Logo marks আর photo preview এই page-er final certificate layout-এর অংশ।
                </div>
              </div>
            </div>
          </PaperSection>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Printer Links</CardTitle>
          </CardHeader>
          <CardContent>
            <PrintVersionsPanel documentType="mfc" documentId={id} />
          </CardContent>
        </Card>
      </div>
    </DoctorPageShell>
  );
}
