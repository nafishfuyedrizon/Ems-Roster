import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { DoctorPageShell, useDoctorGuard } from "@/pages/doctor-shared";
import { doctorFetch } from "@/lib/doctor-api";
import { withApiPath } from "@/lib/api-base";
import { downloadRenderedDocxPage, renderDocxMfcPreview } from "@/lib/docx-mfc-render";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PrintVersionsPanel } from "@/pages/doctor-components";
import type { DoctorSession } from "@/hooks/use-doctor-auth";
import { useToast } from "@/hooks/use-toast";
import { MFC_EYE_CHART_DATA_URI, MFC_LOGO_DATA_URI } from "@/lib/mfc-assets";

const DISPLAY_FONT = '"Playfair Display", Georgia, serif';
const DISPLAY_BLACK_FONT = '"Playfair Display Black", "Playfair Display", Georgia, serif';
const SECTION_FONT = '"Bree Serif", Georgia, serif';
const TABLE_HEADER_FONT = '"Oswald", "Arial Narrow", sans-serif';
const SIGNATURE_FONT = '"Caveat SemiBold", "Segoe Script", "Brush Script MT", cursive';
const CERTIFICATE_FONT = SECTION_FONT;

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

function createSignatureText(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function shouldUseLoggedInOfficer(value: string, doctor: DoctorSession | null): boolean {
  if (!doctor) return !value.trim();
  const trimmed = value.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  const doctorName = doctor.name.trim().toLowerCase();
  const doctorUser = doctor.username.trim().toLowerCase();
  const doctorCallSign = doctor.callSign.trim().toLowerCase();
  if (normalized === doctorName || normalized === doctorUser || normalized === doctorCallSign) return true;
  if (/^[a-z0-9_]+$/i.test(trimmed) || trimmed.includes("_")) return true;
  return false;
}

function resolveOfficerName(rawValue: unknown, doctor: DoctorSession | null): string {
  const value = String(rawValue ?? "").trim();
  if (shouldUseLoggedInOfficer(value, doctor) && doctor?.name) {
    return doctor.name;
  }
  return value;
}

function resolveOfficerSignature(rawValue: unknown, doctor: DoctorSession | null, officerName: string): string {
  const value = String(rawValue ?? "").trim();
  if (shouldUseLoggedInOfficer(value, doctor) && doctor?.name) {
    return createSignatureText(doctor.name);
  }
  if (!value && officerName) return createSignatureText(officerName);
  return value;
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image data."));
    reader.readAsDataURL(blob);
  });
}

async function resolveInlineImageUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) return trimmed;

  const response = await fetch(trimmed, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Image request failed with ${response.status}`);
  }

  const blob = await response.blob();
  return dataUrlFromBlob(blob);
}

function CertificateMark({ className = "" }: { className?: string }) {
  return (
    <img src={MFC_LOGO_DATA_URI} alt="" aria-hidden="true" className={className} />
  );
}

function CertificateHeader() {
  return (
    <div className="px-12 pt-12">
      <div className="border-t border-slate-500 pt-3">
        <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-5 border-b border-slate-500 pb-3">
          <CertificateMark className="h-10 w-10 justify-self-center" />
          <div className="text-center">
            <div className="text-[31px] font-bold uppercase tracking-normal text-slate-900" style={{ fontFamily: DISPLAY_FONT }}>
              Mount Zonah
            </div>
            <div className="mt-1 text-[18px] font-semibold uppercase tracking-normal text-slate-900" style={{ fontFamily: DISPLAY_BLACK_FONT }}>
              Medical Fitness Certificate
            </div>
          </div>
          <CertificateMark className="h-10 w-10 justify-self-center" />
        </div>
      </div>
    </div>
  );
}

function Paper({ children }: { children: React.ReactNode }) {
  return <section className="border border-slate-300 bg-[#fffdfa] shadow-[0_18px_60px_rgba(15,23,42,0.18)]">{children}</section>;
}

function EditableField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2 text-[15px] text-slate-900">
      <div className="font-bold" style={{ fontFamily: CERTIFICATE_FONT }}>
        {label}:
      </div>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="none"
        autoComplete="off"
        className="h-9 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 pb-1 pt-0 text-[16px] font-semibold leading-7 text-slate-900 shadow-none focus-visible:ring-0"
        style={{ fontFamily: CERTIFICATE_FONT }}
      />
    </div>
  );
}

function AutoTextarea({
  value,
  className = "",
  style,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      className={`${className} overflow-hidden`}
      style={style}
      {...props}
    />
  );
}

function PhotoBox({
  url,
  className = "",
  imageClassName = "",
}: {
  url: string;
  className?: string;
  imageClassName?: string;
}) {
  const frameClassName = className || "h-[240px] w-[180px]";
  const resolvedImageClassName = imageClassName || "h-full w-full object-cover object-center px-1 pt-1";
  if (url.trim()) {
    return (
      <div className={`relative ${frameClassName} overflow-hidden border border-slate-500 bg-[#d8d4cd] shadow-sm`}>
        <div className="absolute inset-[4px] bg-[#d9d6cf]" />
        <div className="absolute inset-y-[4px] left-[4px] w-[26px] bg-[#cec9c1]" />
        <div className="absolute inset-y-[4px] left-[28px] w-px bg-[#b6b0a7]" />
        <div className="absolute left-[10px] top-[44%] h-[10px] w-[14px] border border-[#bb7a72] bg-[#efd3cf]" />
        <div className="absolute bottom-[22px] right-[4px] h-[10px] w-[46px] bg-[#445f98]" />
        <img src={url} alt="Applicant" crossOrigin="anonymous" className={`absolute inset-0 z-10 ${resolvedImageClassName}`} />
      </div>
    );
  }

  return (
    <div className={`flex ${frameClassName} items-center justify-center border border-slate-400 bg-white shadow-sm`}>
      <svg viewBox="0 0 64 64" className="h-24 w-24 text-slate-900" aria-hidden="true">
        <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M20 42V24h24v18H20Zm2-2h20V26H22v14Zm3-3 5-7 4 5 3-3 5 8H25Zm15-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function EyeChartImage({ className = "" }: { className?: string }) {
  return (
    <img
      src={MFC_EYE_CHART_DATA_URI}
      alt="Eye test chart"
      className={className || "h-[102px] w-[74px] border border-slate-300 bg-white p-1 object-contain"}
      style={{ imageRendering: "crisp-edges" }}
    />
  );
}

function TextWrap({
  text,
  className = "",
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`whitespace-pre-wrap break-words text-slate-900 ${className}`} style={{ fontFamily: CERTIFICATE_FONT, ...style }}>
      {text}
    </div>
  );
}

function StaticResultBadge({ value }: { value: string }) {
  return (
    <div className="min-w-[58px] border border-emerald-700 bg-[#e8f5df] px-2 py-2 text-center text-[11px] font-semibold uppercase text-emerald-800" style={{ fontFamily: SECTION_FONT }}>
      {value || "ALL GOOD"}
    </div>
  );
}

function StaticFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] items-end gap-2 text-[14px] text-slate-900">
      <div className="font-semibold" style={{ fontFamily: SECTION_FONT }}>
        {label}:
      </div>
      <div className="pb-0.5 text-[14px]" style={{ fontFamily: SECTION_FONT }}>
        {value}
      </div>
    </div>
  );
}

function StaticReportRow({
  title,
  value,
  result,
  extra,
}: {
  title: string;
  value: string;
  result: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="grid border-b border-slate-500 last:border-b-0 md:grid-cols-[minmax(0,1fr)_92px]">
      <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">
        <div className="mb-1 text-[15px] font-bold text-slate-900" style={{ fontFamily: SECTION_FONT }}>
          {title}
        </div>
        <TextWrap text={value} className="text-[12px] leading-[1.15rem]" style={{ fontFamily: SECTION_FONT, fontWeight: 400 }} />
        {extra}
      </div>
      <div className="flex items-center justify-center p-2">
        <StaticResultBadge value={result} />
      </div>
    </div>
  );
}

function StaticEyeReportRow({
  title,
  value,
  result,
}: {
  title: string;
  value: string;
  result: string;
}) {
  return (
    <div className="grid border-b border-slate-500 last:border-b-0 md:grid-cols-[minmax(0,1fr)_92px]">
      <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">
        <div className="mb-1 text-[15px] font-bold text-slate-900" style={{ fontFamily: SECTION_FONT }}>
          {title}
        </div>
        <div className="flex max-w-[220px] flex-col items-start gap-1">
          <EyeChartImage />
          <TextWrap text={value} className="text-[12px] leading-[1.1rem]" style={{ fontFamily: SECTION_FONT, fontWeight: 600 }} />
        </div>
      </div>
      <div className="flex items-center justify-center p-2">
        <StaticResultBadge value={result} />
      </div>
    </div>
  );
}

function StaticSignatureLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-6 text-[15px] text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
      <span className="font-bold text-[#2563eb] underline">{label}</span>{" "}
      <span style={{ fontFamily: SIGNATURE_FONT, fontSize: "28px", fontWeight: 500 }}>
        {value}
      </span>
      <div className="ml-[206px] mt-[-6px] w-[215px] border-b border-slate-300" />
    </div>
  );
}

function EditableEyeReportRow({
  title,
  value,
  onValueChange,
  result,
  onResultChange,
}: {
  title: string;
  value: string;
  onValueChange: (value: string) => void;
  result: string;
  onResultChange: (value: string) => void;
}) {
  return (
    <div className="grid border-b border-slate-500 last:border-b-0 md:grid-cols-[minmax(0,1fr)_92px]">
      <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">
        <div className="mb-1 text-[15px] font-bold text-slate-900" style={{ fontFamily: SECTION_FONT }}>
          {title}
        </div>
        <div className="flex max-w-[220px] flex-col items-start gap-1">
          <EyeChartImage />
          <AutoTextarea
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            rows={2}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            autoComplete="off"
            className="min-h-0 w-full resize-none border-0 bg-transparent px-0 py-0 text-[12px] leading-[1.1rem] text-slate-900 shadow-none focus-visible:ring-0"
            style={{ fontFamily: SECTION_FONT, fontWeight: 600 }}
          />
        </div>
      </div>
      <div className="flex items-center justify-center p-2">
        <Input
          value={result}
          onChange={(event) => onResultChange(event.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="none"
          autoComplete="off"
          className="h-auto min-h-[40px] w-full rounded-none border border-emerald-700 bg-[#e8f5df] px-2 py-2 text-center text-[11px] font-semibold uppercase text-emerald-800 shadow-none focus-visible:ring-0"
          style={{ fontFamily: SECTION_FONT }}
        />
      </div>
    </div>
  );
}

function StaticMfcPageOne({ draft }: { draft: MfcDraft }) {
  return (
    <Paper>
      <CertificateHeader />
      <div className="px-12 pb-7 pt-4" style={{ fontFamily: CERTIFICATE_FONT }}>
        <div className="text-center text-[24px] font-bold text-slate-900" style={{ fontFamily: SECTION_FONT }}>
          Applicant Information
        </div>
        <div className="mt-5 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_168px]">
          <div className="space-y-2">
            <StaticFieldRow label="Name" value={valueOf(draft, "applicantName")} />
            <StaticFieldRow label="Sex" value={valueOf(draft, "sex")} />
            <StaticFieldRow label="D.O.B" value={valueOf(draft, "dateOfBirth")} />
            <StaticFieldRow label="CID" value={valueOf(draft, "cid")} />
            <StaticFieldRow label="Number" value={valueOf(draft, "number")} />
            <StaticFieldRow label="Weight" value={valueOf(draft, "weight")} />
            <StaticFieldRow label="MFC Reason" value={valueOf(draft, "mfcReason")} />
            <StaticFieldRow label="Date" value={valueOf(draft, "examDateText")} />
          </div>
          <div className="flex justify-center md:justify-end">
            <PhotoBox url={valueOf(draft, "sourceAttachmentUrl")} className="h-[162px] w-[130px]" imageClassName="h-full w-full object-cover object-center px-1 pt-1" />
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[24px] font-bold text-slate-900" style={{ fontFamily: SECTION_FONT }}>
            Test Reports:
          </div>
          <div className="border border-slate-500">
            <div className="grid bg-slate-100 text-[15px] font-bold text-[#4f74d6] md:grid-cols-[minmax(0,1fr)_92px]" style={{ fontFamily: TABLE_HEADER_FONT }}>
              <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">Report Title</div>
              <div className="p-2 text-center">Result</div>
            </div>
            <StaticReportRow title="Blood Test:" value={valueOf(draft, "bloodTest")} result={valueOf(draft, "bloodResult")} />
            <StaticReportRow title="MRI Test:" value={valueOf(draft, "mriTest")} result={valueOf(draft, "mriResult")} />
            <StaticEyeReportRow
              title="Eye Test:"
              value={valueOf(draft, "eyeTest")}
              result={valueOf(draft, "eyeResult")}
            />
          </div>
        </div>

        <StaticSignatureLine label="Signature of Medical Officer:" value={valueOf(draft, "officerSignature")} />
      </div>
    </Paper>
  );
}

function StaticMfcPageTwo({ draft }: { draft: MfcDraft }) {
  return (
    <Paper>
      <CertificateHeader />
      <div className="px-12 pb-7 pt-4" style={{ fontFamily: CERTIFICATE_FONT }}>
        <div className="text-center text-[24px] font-bold text-slate-900" style={{ fontFamily: SECTION_FONT }}>
          Applicant Information
        </div>
        <div className="mt-5 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_168px]">
          <div className="space-y-2">
            <StaticFieldRow label="Name" value={valueOf(draft, "applicantName")} />
            <StaticFieldRow label="Sex" value={valueOf(draft, "sex")} />
            <StaticFieldRow label="D.O.B" value={valueOf(draft, "dateOfBirth")} />
            <StaticFieldRow label="CID" value={valueOf(draft, "cid")} />
            <StaticFieldRow label="Number" value={valueOf(draft, "number")} />
            <StaticFieldRow label="Weight" value={valueOf(draft, "weight")} />
            <StaticFieldRow label="MFC Reason" value={valueOf(draft, "mfcReason")} />
            <StaticFieldRow label="Date" value={valueOf(draft, "examDateText")} />
          </div>
          <div className="flex justify-center md:justify-end">
            <PhotoBox url={valueOf(draft, "sourceAttachmentUrl")} className="h-[162px] w-[130px]" imageClassName="h-full w-full object-cover object-center px-1 pt-1" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[170px_minmax(0,1fr)] items-start gap-2 text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
          <div className="pt-1 text-[16px] font-bold" style={{ fontFamily: SECTION_FONT }}>Description:</div>
          <TextWrap text={valueOf(draft, "finalSummary")} className="text-[16px] font-bold leading-8" />
        </div>

        <div className="mt-6 space-y-3 text-[15px] text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
          <div className="grid grid-cols-[230px_minmax(0,1fr)] items-center gap-2">
            <div className="font-bold text-[#2563eb] underline" style={{ fontFamily: SECTION_FONT }}>Name of Medical Officer:</div>
            <div className="border-b border-slate-300 pb-1 text-[17px] font-extrabold">{valueOf(draft, "officerName")}</div>
          </div>
          <div className="grid grid-cols-[262px_minmax(0,1fr)] items-center gap-2">
            <div className="font-bold text-[#2563eb] underline" style={{ fontFamily: SECTION_FONT }}>Signature of Medical Officer:</div>
            <div className="border-b border-slate-300 pb-1 text-[30px] leading-none text-slate-900" style={{ fontFamily: SIGNATURE_FONT, fontWeight: 500 }}>
              {valueOf(draft, "officerSignature")}
            </div>
          </div>
        </div>
      </div>
    </Paper>
  );
}

function EditableReportRow({
  title,
  value,
  onValueChange,
  result,
  onResultChange,
  extra,
}: {
  title: string;
  value: string;
  onValueChange: (value: string) => void;
  result: string;
  onResultChange: (value: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="grid border-b border-slate-500 last:border-b-0 md:grid-cols-[minmax(0,1fr)_116px]">
      <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">
        <div className="mb-1 text-[15px] font-bold text-slate-900" style={{ fontFamily: SECTION_FONT }}>
          {title}
        </div>
        <AutoTextarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          rows={title === "MRI Test:" ? 7 : 4}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="none"
          autoComplete="off"
          className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-[12px] leading-[1.15rem] text-slate-900 shadow-none focus-visible:ring-0"
          style={{ fontFamily: SECTION_FONT, fontWeight: 400 }}
        />
        {extra}
      </div>
      <div className="flex items-center justify-center p-2">
        <Input
          value={result}
          onChange={(event) => onResultChange(event.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="none"
          autoComplete="off"
          className="h-auto min-h-[40px] w-full rounded-none border border-emerald-700 bg-[#e8f5df] px-2 py-2 text-center text-[11px] font-semibold uppercase text-emerald-800 shadow-none focus-visible:ring-0"
          style={{ fontFamily: SECTION_FONT }}
        />
      </div>
    </div>
  );
}

export default function DoctorMfcDetail() {
  const queryClient = useQueryClient();
  const [, params] = useRoute("/doctor/mfc/:id");
  const id = Number(params?.id);
  const { doctor } = useDoctorGuard();
  const { toast } = useToast();
  const photoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const { data } = useQuery<any>({
    queryKey: ["doctor-mfc-detail", id],
    queryFn: () => doctorFetch(`/mfc-cases/${id}`),
    enabled: Number.isFinite(id),
  });
  const [draft, setDraft] = useState<MfcDraft>({});
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState("");
  useEffect(() => {
    if (!data) return;
    const officerName = resolveOfficerName(data.officerName, doctor);
    const officerSignature = resolveOfficerSignature(data.officerSignature, doctor, officerName);
    setDraft({
      applicantName: data.applicantName ?? "",
      cid: data.cid ?? "",
      sex: data.sex ?? "",
      dateOfBirth: data.dateOfBirth ?? "",
      number: data.number ?? "",
      weight: data.weight ?? "",
      examDateText: data.examDateText ?? "",
      officerName,
      officerSignature,
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
  }, [data, doctor]);

  useEffect(() => {
    let cancelled = false;
    const rawUrl = valueOf(draft, "sourceAttachmentUrl").trim();
    if (!rawUrl) {
      setResolvedPhotoUrl("");
      return;
    }

    resolveInlineImageUrl(rawUrl)
      .then((nextUrl) => {
        if (!cancelled) setResolvedPhotoUrl(nextUrl || rawUrl);
      })
      .catch(() => {
        if (!cancelled) setResolvedPhotoUrl(rawUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [draft.sourceAttachmentUrl]);

  const setField = (field: string, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await dataUrlFromBlob(file);
      setResolvedPhotoUrl(dataUrl);
      setField("sourceAttachmentUrl", dataUrl);
      toast({
        title: "Photo uploaded",
        description: `${file.name} is ready for preview and download.`,
      });
    } catch (error) {
      toast({
        title: "Photo upload failed",
        description: error instanceof Error ? error.message : "Could not read the selected image.",
        variant: "destructive",
      });
    }
  };

  const buildDraftPayload = () => {
    const officerName = valueOf(draft, "officerName").trim() || doctor?.name || "";
    const officerSignature = valueOf(draft, "officerSignature").trim() || createSignatureText(officerName);
    return {
      ...draft,
      officerName,
      officerSignature,
    };
  };

  const save = async () => {
    const payload = buildDraftPayload();
    setDraft(payload);
    await doctorFetch(`/mfc-cases/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    await queryClient.invalidateQueries({ queryKey: ["doctor-mfc-detail", id] });
  };

  const complete = async () => {
    const payload = buildDraftPayload();
    setDraft(payload);
    await doctorFetch(`/mfc-cases/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    await doctorFetch(`/mfc-cases/${id}/complete`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["doctor-mfc-detail", id] });
  };

  const downloadDocxPreviewPage = async (page: 1 | 2) => {
    const host = document.createElement("div");
    host.className = "pointer-events-none fixed left-[-20000px] top-0 z-[-1]";
    document.body.appendChild(host);

    try {
      const payload = buildDraftPayload();
      setDraft(payload);
      await doctorFetch(`/mfc-cases/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

      const response = await fetch(withApiPath(`/documents/mfc/${id}/template.docx`), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`DOCX fetch failed with status ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      await renderDocxMfcPreview(host, buffer);
      await downloadRenderedDocxPage(host, id, page);
    } catch (error) {
      toast({
        title: `Failed to download page ${page}`,
        description: error instanceof Error ? error.message : "Could not prepare the DOCX preview download.",
        variant: "destructive",
      });
    } finally {
      host.remove();
    }
  };

  return (
    <DoctorPageShell>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>MFC Editor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Applicant Photo URL</div>
                <button
                  type="button"
                  onClick={() => photoUploadInputRef.current?.click()}
                  className="inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/18"
                >
                  Upload Photo
                </button>
              </div>
              <Input
                value={valueOf(draft, "sourceAttachmentUrl")}
                onChange={(event) => setField("sourceAttachmentUrl", event.target.value)}
                placeholder="https://..."
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                autoComplete="off"
              />
              <input
                ref={photoUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handlePhotoUpload(event)}
              />
              <div className="text-[11px] text-muted-foreground">You can use either an image link or upload a photo file.</div>
            </div>
            <Button onClick={() => void save()}>Save Changes</Button>
            <Button variant="outline" onClick={() => void complete()}>Complete MFC</Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div>
          <Paper>
            <CertificateHeader />
            <div className="px-12 pb-8 pt-4" style={{ fontFamily: CERTIFICATE_FONT }}>
              <div className="text-center text-[18px] font-bold text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
                Applicant Information
              </div>
              <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
                <div className="space-y-3">
                  <EditableField label="Name" value={valueOf(draft, "applicantName")} onChange={(value) => setField("applicantName", value)} />
                  <EditableField label="Sex" value={valueOf(draft, "sex")} onChange={(value) => setField("sex", value)} />
                  <EditableField label="D.O.B" value={valueOf(draft, "dateOfBirth")} onChange={(value) => setField("dateOfBirth", value)} />
                  <EditableField label="CID" value={valueOf(draft, "cid")} onChange={(value) => setField("cid", value)} />
                  <EditableField label="Number" value={valueOf(draft, "number")} onChange={(value) => setField("number", value)} />
                  <EditableField label="Weight" value={valueOf(draft, "weight")} onChange={(value) => setField("weight", value)} />
                  <EditableField label="MFC Reason" value={valueOf(draft, "mfcReason")} onChange={(value) => setField("mfcReason", value)} />
                  <EditableField label="Date" value={valueOf(draft, "examDateText")} onChange={(value) => setField("examDateText", value)} />
                </div>
                <div className="flex justify-center md:justify-end">
                  <PhotoBox url={resolvedPhotoUrl || valueOf(draft, "sourceAttachmentUrl")} imageClassName="h-full w-full object-cover object-center px-1 pt-1" />
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-2 text-[18px] font-bold text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
                  Test Reports:
                </div>
                <div className="border border-slate-500">
                  <div className="grid bg-slate-100 text-[15px] font-bold text-[#3b82f6] md:grid-cols-[minmax(0,1fr)_116px]" style={{ fontFamily: CERTIFICATE_FONT }}>
                    <div className="border-b border-slate-500 p-2 md:border-b-0 md:border-r">Report Title</div>
                    <div className="p-2 text-center">Result</div>
                  </div>
                  <EditableReportRow
                    title="Blood Test:"
                    value={valueOf(draft, "bloodTest")}
                    onValueChange={(value) => setField("bloodTest", value)}
                    result={valueOf(draft, "bloodResult")}
                    onResultChange={(value) => setField("bloodResult", value)}
                  />
                  <EditableReportRow
                    title="MRI Test:"
                    value={valueOf(draft, "mriTest")}
                    onValueChange={(value) => setField("mriTest", value)}
                    result={valueOf(draft, "mriResult")}
                    onResultChange={(value) => setField("mriResult", value)}
                  />
                  <EditableEyeReportRow
                    title="Eye Test:"
                    value={valueOf(draft, "eyeTest")}
                    onValueChange={(value) => setField("eyeTest", value)}
                    result={valueOf(draft, "eyeResult")}
                    onResultChange={(value) => setField("eyeResult", value)}
                  />
                </div>
              </div>

              <div className="mt-6 text-[15px] text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
                <span className="font-bold text-[#2563eb] underline">Signature of Medical Officer:</span>{" "}
                <span style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Segoe Print', cursive", fontSize: "28px", fontWeight: 500 }}>
                  {valueOf(draft, "officerSignature")}
                </span>
                <div className="ml-[206px] mt-[-6px] w-[215px] border-b border-slate-300" />
              </div>
            </div>
          </Paper>
          </div>

          <div>
          <Paper>
            <CertificateHeader />
            <div className="px-12 pb-8 pt-4" style={{ fontFamily: CERTIFICATE_FONT }}>
              <div className="text-center text-[18px] font-bold text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
                Applicant Information
              </div>
              <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
                <div className="space-y-3">
                  <EditableField label="Name" value={valueOf(draft, "applicantName")} onChange={(value) => setField("applicantName", value)} />
                  <EditableField label="Sex" value={valueOf(draft, "sex")} onChange={(value) => setField("sex", value)} />
                  <EditableField label="D.O.B" value={valueOf(draft, "dateOfBirth")} onChange={(value) => setField("dateOfBirth", value)} />
                  <EditableField label="CID" value={valueOf(draft, "cid")} onChange={(value) => setField("cid", value)} />
                  <EditableField label="Number" value={valueOf(draft, "number")} onChange={(value) => setField("number", value)} />
                  <EditableField label="Weight" value={valueOf(draft, "weight")} onChange={(value) => setField("weight", value)} />
                  <EditableField label="MFC Reason" value={valueOf(draft, "mfcReason")} onChange={(value) => setField("mfcReason", value)} />
                  <EditableField label="Date" value={valueOf(draft, "examDateText")} onChange={(value) => setField("examDateText", value)} />
                </div>
                <div className="flex justify-center md:justify-end">
                  <PhotoBox url={resolvedPhotoUrl || valueOf(draft, "sourceAttachmentUrl")} imageClassName="h-full w-full object-cover object-center px-1 pt-1" />
                </div>
              </div>

              <div className="mt-8 grid grid-cols-[170px_minmax(0,1fr)] items-start gap-2 text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
                <div className="pt-1 text-[16px] font-extrabold">Description:</div>
                <AutoTextarea
                  value={valueOf(draft, "finalSummary")}
                  onChange={(event) => setField("finalSummary", event.target.value)}
                  rows={5}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  autoComplete="off"
                  className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 text-[16px] leading-8 text-slate-900 shadow-none focus-visible:ring-0"
                  style={{ fontFamily: CERTIFICATE_FONT, fontWeight: 700 }}
                />
              </div>

              <div className="mt-6 space-y-3 text-[15px] text-slate-900" style={{ fontFamily: CERTIFICATE_FONT }}>
                <div className="grid grid-cols-[230px_minmax(0,1fr)] items-center gap-2">
                  <div className="font-extrabold text-[#2563eb] underline">Name of Medical Officer:</div>
                  <Input
                    value={valueOf(draft, "officerName")}
                    onChange={(event) => setField("officerName", event.target.value)}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    autoComplete="off"
                    className="h-9 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 py-0 text-[17px] font-extrabold leading-7 text-slate-900 shadow-none focus-visible:ring-0"
                    style={{ fontFamily: CERTIFICATE_FONT }}
                  />
                </div>
                <div className="grid grid-cols-[262px_minmax(0,1fr)] items-center gap-2">
                  <div className="font-extrabold text-[#2563eb] underline">Signature of Medical Officer:</div>
                  <Input
                    value={valueOf(draft, "officerSignature")}
                    onChange={(event) => setField("officerSignature", event.target.value)}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    autoComplete="off"
                    className="h-11 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 py-0 text-[30px] leading-none text-slate-900 shadow-none focus-visible:ring-0"
                    style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Segoe Print', cursive", fontWeight: 500 }}
                  />
                </div>
              </div>
            </div>
          </Paper>
          </div>
        </div>

        <PrintVersionsPanel
          documentType="mfc"
          documentId={id}
          customDownloads={[
            { label: "Download Page 1", onClick: () => void downloadDocxPreviewPage(1) },
            { label: "Download Page 2", onClick: () => void downloadDocxPreviewPage(2) },
          ]}
        />
      </div>
    </DoctorPageShell>
  );
}
