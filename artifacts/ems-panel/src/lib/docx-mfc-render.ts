import { toBlob } from "html-to-image";
import { renderAsync } from "docx-preview";

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

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }),
    ),
  );
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

export async function renderDocxMfcPreview(host: HTMLDivElement, buffer: ArrayBuffer) {
  host.innerHTML = "";
  await renderAsync(buffer, host, host, {
    className: "docx-preview",
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    renderHeaders: true,
    renderFooters: true,
    useBase64URL: true,
  });

  const pageCount = splitRenderedDocxPages(host);
  normalizeRenderedPhotoPlacement(host);
  await waitForImages(host);
  return pageCount;
}

export async function downloadRenderedDocxPage(host: HTMLDivElement, id: number, page: 1 | 2) {
  const blob = await renderedDocxPageToBlob(host, page);
  downloadBlob(blob, `mfc-${id}-docx-page-${page}.png`);
}

export async function renderedDocxPageToBlob(host: HTMLDivElement, page: 1 | 2) {
  const pages = Array.from(host.querySelectorAll<HTMLElement>("section.docx-preview"));
  const target = pages[page - 1];
  if (!target) {
    throw new Error(`Rendered DOCX page ${page} not found.`);
  }

  const referencePage = pages[0] ?? target;
  const pageRect = referencePage.getBoundingClientRect();
  const exportWidth = Math.ceil(pageRect.width);
  const exportHeight = page === 1 ? Math.ceil(pageRect.height) : measurePageContentHeight(target);
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

  return blob;
}
