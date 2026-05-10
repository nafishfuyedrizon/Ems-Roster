import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, LoaderCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { doctorFetch } from "@/lib/doctor-api";
import { withApiPath } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

export function DoctorStatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-primary">{value}</div>
        {subtext ? <p className="mt-2 text-xs text-muted-foreground">{subtext}</p> : null}
      </CardContent>
    </Card>
  );
}

export function PrintVersionsPanel({
  documentType,
  documentId,
  customDownloads,
}: {
  documentType: string;
  documentId: number;
  customDownloads?: Array<{ label: string; onClick: () => void | Promise<void> }>;
}) {
  const { toast } = useToast();
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [completedDownload, setCompletedDownload] = useState<string | null>(null);

  useEffect(() => {
    if (!completedDownload) return;
    const timeout = window.setTimeout(() => setCompletedDownload(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [completedDownload]);

  const { data } = useQuery<any[]>({
    queryKey: ["print-versions", documentType, documentId],
    queryFn: () => doctorFetch(`/documents/${documentType}/${documentId}/print-versions`),
  });

  const buildPageDownloadUrl = (page: number) =>
    `${withApiPath(`/documents/${documentType}/${documentId}/page/${page}.png`)}?download=1`;

  const buildCombinedDownloadUrl = () =>
    `${withApiPath(`/documents/${documentType}/${documentId}/image.png`)}?download=1`;

  const downloadButtons = useMemo(() => {
    if (customDownloads && customDownloads.length > 0) {
      return customDownloads.map((download) => ({
        key: download.label,
        label: download.label,
        onClick: download.onClick,
      }));
    }

    if (documentType === "mfc") {
      return [
        { key: "Download Page 1", label: "Download Page 1", href: buildPageDownloadUrl(1) },
        { key: "Download Page 2", label: "Download Page 2", href: buildPageDownloadUrl(2) },
      ];
    }

    return [{ key: "Download File", label: "Download File", href: buildCombinedDownloadUrl() }];
  }, [customDownloads, documentId, documentType]);

  const triggerLinkDownload = (href: string) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleDownload = async (download: { key: string; label: string; onClick?: () => void | Promise<void>; href?: string }) => {
    if (activeDownload) return;
    setCompletedDownload(null);
    setActiveDownload(download.key);
    try {
      if (download.onClick) {
        await download.onClick();
      } else if (download.href) {
        triggerLinkDownload(download.href);
      }
      setCompletedDownload(download.key);
    } catch (error) {
      toast({
        title: `Failed to start ${download.label.toLowerCase()}`,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActiveDownload(null);
    }
  };

  const renderDownloadButton = (download: { key: string; label: string; onClick?: () => void | Promise<void>; href?: string }) => {
    const isProcessing = activeDownload === download.key;
    const isDone = completedDownload === download.key;
    return (
      <button
        key={download.key}
        type="button"
        disabled={isProcessing || activeDownload !== null}
        onClick={() => void handleDownload(download)}
        className={[
          "group relative overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all duration-300",
          "bg-[linear-gradient(180deg,rgba(13,20,37,0.98),rgba(10,15,28,0.94))]",
          "shadow-[0_16px_36px_rgba(2,6,23,0.32),inset_0_1px_0_rgba(255,255,255,0.08)]",
          "hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(8,145,178,0.24),inset_0_1px_0_rgba(255,255,255,0.1)]",
          "disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-100",
          isDone ? "border-emerald-400/70" : "border-cyan-400/25 hover:border-cyan-300/60",
          isProcessing ? "border-cyan-300/70" : "",
        ].join(" ")}
      >
        <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-cyan-400/12 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-mono text-[13px] uppercase tracking-[0.34em] text-white/92">{download.label}</div>
            <div className="text-xs tracking-[0.28em] text-cyan-200/72 uppercase">
              {isProcessing ? "Processing download..." : isDone ? "Finished downloading" : "DOCX render export"}
            </div>
          </div>
          <div
            className={[
              "flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-300",
              isDone
                ? "border-emerald-300/60 bg-emerald-400/18 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_rgba(16,185,129,0.25)]"
                : isProcessing
                  ? "border-cyan-300/60 bg-cyan-400/16 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_rgba(34,211,238,0.2)]"
                  : "border-white/10 bg-white/6 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_18px_rgba(15,23,42,0.28)]",
            ].join(" ")}
          >
            {isProcessing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : isDone ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Card className="overflow-hidden border-cyan-500/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_32%),linear-gradient(180deg,rgba(9,14,28,0.98),rgba(7,12,24,0.96))] shadow-[0_28px_70px_rgba(2,6,23,0.45)]">
      <CardHeader className="border-b border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Premium Export
            </div>
            <CardTitle className="text-base uppercase tracking-[0.28em] text-white">Printer Links</CardTitle>
            <p className="max-w-2xl text-sm text-slate-300">
              Generate the latest print package, then export polished DOCX-based PNG pages with live progress feedback.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Export Mode</div>
            <div className="mt-1 font-mono text-sm uppercase tracking-[0.28em] text-cyan-100">
              {activeDownload ? "Processing" : completedDownload ? "Finished" : "Ready"}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3">
          {downloadButtons.map((download) => renderDownloadButton(download))}
        </div>
        <div className="space-y-3">
          {(data ?? []).map((version) => (
            <div key={version.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-sm font-semibold text-white">Version {version.versionNumber}</p>
              <a href={version.directUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-cyan-300 underline">
                {version.directUrl}
              </a>
              {version.externalImageUrl ? (
                <a href={version.externalImageUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-cyan-400 underline">
                  {version.externalImageUrl}
                </a>
              ) : null}
              {Array.isArray(version.pageLinks) && version.pageLinks.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {version.pageLinks.map((link: { page: number; url: string }) => (
                    <a key={link.page} href={link.url} target="_blank" rel="noreferrer" className="block break-all text-xs text-cyan-400 underline">
                      {`Page ${link.page} link: ${link.url}`}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
