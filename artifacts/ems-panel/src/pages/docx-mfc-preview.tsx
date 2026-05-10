import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { renderAsync } from "docx-preview";
import { toBlob } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withApiPath } from "@/lib/api-base";

type RenderState = "idle" | "loading" | "ready" | "error";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function splitRenderedDocxPages(host: HTMLDivElement) {
  const existingPages = host.querySelectorAll("section.docx-preview");
  if (existingPages.length !== 1) return existingPages.length;

  const wrapper = host.querySelector(".docx-preview-wrapper");
  const firstSection = existingPages[0] as HTMLElement | undefined;
  const article = firstSection?.querySelector(":scope > article");
  if (!wrapper || !firstSection || !(article instanceof HTMLElement)) {
    return existingPages.length;
  }

  const articleChildren = Array.from(article.children) as HTMLElement[];
  let mountHeaderCount = 0;
  let splitStartIndex = -1;

  for (let index = 0; index < articleChildren.length; index += 1) {
    const text = (articleChildren[index].textContent || "").replace(/\s+/g, " ").trim();
    if (text === "MOUNT ZONAH") {
      mountHeaderCount += 1;
      if (mountHeaderCount === 2) {
        splitStartIndex = index;
        break;
      }
    }
  }

  if (splitStartIndex <= 0) return existingPages.length;

  const secondSection = firstSection.cloneNode(false) as HTMLElement;
  const secondArticle = article.cloneNode(false) as HTMLElement;
  const footer = firstSection.querySelector(":scope > footer");

  for (const node of articleChildren.slice(splitStartIndex)) {
    secondArticle.appendChild(node);
  }

  secondSection.appendChild(secondArticle);
  if (footer) {
    secondSection.appendChild(footer.cloneNode(true));
  }

  wrapper.appendChild(secondSection);
  return host.querySelectorAll("section.docx-preview").length;
}

function buildPhotoFrame(photoSrc: string, top: string) {
  const frame = document.createElement("div");
  frame.dataset.docxPhotoFrame = "true";
  frame.style.position = "absolute";
  frame.style.top = top;
  frame.style.right = "72px";
  frame.style.width = "178px";
  frame.style.height = "188px";
  frame.style.border = "2px solid #2b3444";
  frame.style.background = "#ffffff";
  frame.style.padding = "8px";
  frame.style.boxSizing = "border-box";
  frame.style.display = "flex";
  frame.style.alignItems = "stretch";
  frame.style.justifyContent = "stretch";
  frame.style.zIndex = "3";

  const image = document.createElement("img");
  image.src = photoSrc;
  image.style.width = "100%";
  image.style.height = "100%";
  image.style.objectFit = "cover";
  image.style.objectPosition = "center top";
  image.style.display = "block";

  frame.appendChild(image);
  return frame;
}

function normalizeRenderedPhotoPlacement(host: HTMLDivElement) {
  const images = Array.from(host.querySelectorAll("img")) as HTMLImageElement[];
  const pages = Array.from(host.querySelectorAll("section.docx-preview")) as HTMLElement[];
  if (images.length === 0 || pages.length === 0) return;

  const photoSrc =
    images
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .sort((left, right) => right.length - left.length)[0] || "";

  if (!photoSrc) return;

  for (const image of images) {
    const imageSrc = image.currentSrc || image.src;
    if (imageSrc !== photoSrc) continue;
    if (image.closest("[data-docx-photo-frame='true']")) continue;
    image.remove();
  }

  for (const [index, page] of pages.slice(0, 2).entries()) {
    const existingFrame = page.querySelector("[data-docx-photo-frame='true']");
    if (existingFrame) continue;

    if (index === 1) {
      const article = page.querySelector(":scope > article");
      const articleChildren = article ? (Array.from(article.children) as HTMLElement[]) : [];
      const descriptionParagraph = articleChildren.find((child) =>
        (child.textContent || "").replace(/\s+/g, " ").trim().startsWith("Description:"),
      );
      const officerNameParagraph = articleChildren.find((child) =>
        (child.textContent || "").replace(/\s+/g, " ").trim().startsWith("Name of Medical Officer:"),
      );
      const signatureParagraph = articleChildren.find((child) =>
        (child.textContent || "").replace(/\s+/g, " ").trim().startsWith("Signature of Medical Officer:"),
      );

      if (descriptionParagraph) {
        descriptionParagraph.style.marginTop = "95px";
        descriptionParagraph.style.marginBottom = "10px";
        descriptionParagraph.style.lineHeight = "1.35";
      }

      if (officerNameParagraph) {
        officerNameParagraph.style.marginTop = "8px";
        officerNameParagraph.style.marginBottom = "4px";
        officerNameParagraph.style.lineHeight = "1.2";
      }

      if (signatureParagraph) {
        signatureParagraph.style.marginTop = "4px";
        signatureParagraph.style.lineHeight = "1.2";
      }
    }

    page.appendChild(buildPhotoFrame(photoSrc, index === 0 ? "180px" : "190px"));
  }
}

function measurePageContentHeight(page: HTMLElement) {
  const targetRect = page.getBoundingClientRect();
  const article = page.querySelector(":scope > article");
  const footer = page.querySelector(":scope > footer");
  const articleChildren = article ? (Array.from(article.children) as HTMLElement[]) : [];
  const footerChildren = footer ? (Array.from(footer.children) as HTMLElement[]) : [];
  const frame = page.querySelector("[data-docx-photo-frame='true']");
  let contentBottom = 0;

  for (const child of [...articleChildren, ...footerChildren]) {
    const rect = child.getBoundingClientRect();
    if (rect.height <= 0) continue;
    contentBottom = Math.max(contentBottom, rect.bottom - targetRect.top);
  }

  if (frame instanceof HTMLElement) {
    const rect = frame.getBoundingClientRect();
    contentBottom = Math.max(contentBottom, rect.bottom - targetRect.top);
  }

  return contentBottom > 0 ? Math.ceil(contentBottom + 24) : Math.ceil(targetRect.height);
}

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

        await renderAsync(buffer, previewRef.current, previewRef.current, {
          className: "docx-preview",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          useBase64URL: true,
        });

        if (cancelled || !previewRef.current) return;

        const splitPageCount = splitRenderedDocxPages(previewRef.current);
        normalizeRenderedPhotoPlacement(previewRef.current);
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
    const pages = Array.from(previewRef.current.querySelectorAll<HTMLElement>("section.docx-preview"));
    const target = pages[page - 1];
    if (!target) return;

    const referencePage = pages[0] ?? target;
    const pageRect = referencePage.getBoundingClientRect();
    const exportWidth = Math.ceil(pageRect.width);
    const exportHeight = page === 1 ? Math.ceil(pageRect.height) : measurePageContentHeight(target);

    setDownloadingPage(page);
    try {
      const blob = await toBlob(target, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2.5,
        width: exportWidth,
        height: exportHeight,
        canvasWidth: exportWidth,
        canvasHeight: exportHeight,
        skipFonts: false,
        style: {
          boxShadow: "none",
          margin: "0",
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
        },
      });

      if (!blob) {
        throw new Error("PNG generation returned an empty file.");
      }

      downloadBlob(blob, `mfc-${id}-docx-page-${page}.png`);
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
