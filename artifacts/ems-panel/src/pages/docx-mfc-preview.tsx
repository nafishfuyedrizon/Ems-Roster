import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withApiPath } from "@/lib/api-base";
import { downloadRenderedDocxPage, renderDocxMfcPreview } from "@/lib/docx-mfc-render";

type RenderState = "idle" | "loading" | "ready" | "error";

export default function DocxMfcPreview() {
  const [, params] = useRoute("/preview/mfc-docx/:id");
  const id = Number(params?.id);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const autoDownloadKeyRef = useRef("");
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [pageCount, setPageCount] = useState(0);
  const [errorText, setErrorText] = useState("");
  const [downloadingPage, setDownloadingPage] = useState<number | null>(null);

  const docxUrl = useMemo(() => {
    if (!Number.isFinite(id) || id <= 0) return "";
    return withApiPath(`/documents/mfc/${id}/template.docx`);
  }, [id]);

  const autoDownloadRequest = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const download = searchParams.get("download");
    const page = Number(searchParams.get("page"));
    if (download !== "png" || (page !== 1 && page !== 2)) return null;
    return { page: page as 1 | 2 };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function renderDocx() {
      if (!docxUrl || !previewRef.current) {
        setRenderState("error");
        setErrorText("Preview route is missing a valid MFC id.");
        setPageCount(0);
        return;
      }

      setRenderState("loading");
      setErrorText("");
      setPageCount(0);
      previewRef.current.innerHTML = "";

      try {
        const response = await fetch(docxUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`DOCX fetch failed with status ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        if (cancelled || !previewRef.current) return;

        const splitPageCount = await renderDocxMfcPreview(previewRef.current, buffer);
        setPageCount(splitPageCount);
        setRenderState("ready");
      } catch (error) {
        if (cancelled) return;
        setRenderState("error");
        setPageCount(0);
        setErrorText(error instanceof Error ? error.message : "DOCX preview failed.");
      }
    }

    void renderDocx();

    return () => {
      cancelled = true;
    };
  }, [docxUrl]);

  const downloadDocx = () => {
    const anchor = document.createElement("a");
    anchor.href = `${docxUrl}?download=1`;
    anchor.download = `mfc-${id}-template.docx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadPngFromRenderedPage = async (page: number) => {
    if (!previewRef.current) return;
    setDownloadingPage(page);
    try {
      await downloadRenderedDocxPage(previewRef.current, id, page as 1 | 2);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "PNG download failed.");
      setRenderState("error");
    } finally {
      setDownloadingPage(null);
    }
  };

  useEffect(() => {
    if (renderState !== "ready" || downloadingPage !== null || !autoDownloadRequest) return;
    if (pageCount < autoDownloadRequest.page) return;

    const requestKey = `${id}:${autoDownloadRequest.page}`;
    if (autoDownloadKeyRef.current === requestKey) return;
    autoDownloadKeyRef.current = requestKey;
    void downloadPngFromRenderedPage(autoDownloadRequest.page);
  }, [autoDownloadRequest, downloadingPage, id, pageCount, renderState]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Card className="border-border/50 bg-card/90">
          <CardHeader>
            <CardTitle>DOCX Template Preview</CardTitle>
            <CardDescription>
              This page renders the generated DOCX itself. PNG downloads below are captured from the actual rendered DOCX pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={downloadDocx} disabled={!docxUrl}>
                Download DOCX
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void downloadPngFromRenderedPage(1)}
                disabled={renderState !== "ready" || pageCount < 1 || downloadingPage !== null}
              >
                {downloadingPage === 1 ? "Rendering Page 1..." : "Download Page 1 PNG"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void downloadPngFromRenderedPage(2)}
                disabled={renderState !== "ready" || pageCount < 2 || downloadingPage !== null}
              >
                {downloadingPage === 2 ? "Rendering Page 2..." : "Download Page 2 PNG"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {renderState === "loading" && "Rendering DOCX pages..."}
              {renderState === "ready" && `Rendered pages: ${pageCount}. PNG downloads come from this exact preview.`}
              {renderState === "error" && `Preview error: ${errorText}`}
            </p>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-500/70 p-4 shadow-sm">
          <div ref={previewRef} className="docx-preview-host min-h-[320px]" />
        </div>
      </div>
    </div>
  );
}
