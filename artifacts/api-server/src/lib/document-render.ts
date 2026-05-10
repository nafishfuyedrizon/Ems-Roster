import { MFC_EYE_CHART_DATA_URI, MFC_LOGO_DATA_URI } from "./mfc-assets.js";

function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function linesBlock(lines: string[], startY: number, lineHeight = 28): string {
  return lines.map((line, index) => `<text x="70" y="${startY + index * lineHeight}" font-size="20" fill="#222" font-family="'Segoe UI', sans-serif">${esc(line)}</text>`).join("");
}

function wrapText(input: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of String(input || "").split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function textLines(x: number, y: number, lines: string[], options?: { size?: number; weight?: number | string; color?: string; lineHeight?: number; anchor?: string }): string {
  const size = options?.size ?? 20;
  const color = options?.color ?? "#222";
  const lineHeight = options?.lineHeight ?? Math.round(size * 1.55);
  const anchor = options?.anchor ? ` text-anchor="${options.anchor}"` : "";
  const weight = options?.weight ? ` font-weight="${options.weight}"` : "";
  const tspans = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-family="'Segoe UI', sans-serif"${weight}${anchor}>${tspans}</text>`;
}

function applicantFields(input: Record<string, unknown>): Array<[string, string]> {
  return [
    ["Name", String(input.applicantName ?? "N/a")],
    ["Sex", String(input.sex ?? "N/a")],
    ["D.O.B", String(input.dateOfBirth ?? "N/a")],
    ["CID", String(input.cid ?? "N/a")],
    ["Number", String(input.number ?? "N/a")],
    ["Weight", String(input.weight ?? "N/a")],
    ["MFC Reason", String(input.mfcReason ?? "N/a")],
    ["Date", String(input.examDateText ?? "N/a")],
  ];
}

function renderApplicantBlock(fields: Array<[string, string]>, startX: number, startY: number): string {
  return fields
    .map(([label, value], index) => {
      const x = index % 2 === 0 ? startX : startX + 540;
      const y = startY + Math.floor(index / 2) * 72;
      return `
  <text x="${x}" y="${y}" font-size="22" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">${esc(label)}:</text>
  <line x1="${x + 112}" y1="${y + 8}" x2="${x + 460}" y2="${y + 8}" stroke="#94a3b8" stroke-width="1.2"/>
  <text x="${x + 126}" y="${y}" font-size="20" fill="#1f2937" font-family="'Segoe UI', sans-serif">${esc(value)}</text>`;
    })
    .join("");
}

function renderApplicantColumn(fields: Array<[string, string]>, startX: number, startY: number): string {
  return fields
    .map(([label, value], index) => {
      const y = startY + index * 44;
      return `<text x="${startX}" y="${y}" font-size="18" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">${esc(label)}: ${esc(value)}</text>`;
    })
    .join("");
}

function renderMountZonahMark(x: number, y: number, size: number): string {
  return `<image href="${MFC_LOGO_DATA_URI}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
}

function renderPhotoFrame(x: number, y: number, width: number, height: number, imageUrl: string): string {
  const safeUrl = esc(imageUrl);
  if (safeUrl) {
    return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff" stroke="#111827" stroke-width="1.2"/>
    <image href="${safeUrl}" x="${x + 2}" y="${y + 2}" width="${width - 4}" height="${height - 4}" preserveAspectRatio="xMidYMid slice"/>
    `;
  }
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff" stroke="#111827" stroke-width="1.2"/>
    <circle cx="${x + width / 2}" cy="${y + height / 2}" r="66" fill="none" stroke="#111827" stroke-width="6"/>
    <rect x="${x + width / 2 - 42}" y="${y + height / 2 - 26}" width="84" height="52" fill="none" stroke="#111827" stroke-width="6"/>
    <path d="M${x + width / 2 - 28} ${y + height / 2 + 20}l20-28 16 16 10-12 20 24" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x + width / 2 + 18}" cy="${y + height / 2 - 8}" r="7" fill="#111827"/>
    <path d="M${x + width / 2 + 12} ${y + height / 2 + 42}h28M${x + width / 2 + 26} ${y + height / 2 + 28}v28" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
  `;
}

function renderSignatureLine(label: string, value: string, x: number, y: number): string {
  const signatureX = x + 340;
  return `
  <text x="${x}" y="${y}" font-size="22" fill="#111827" font-family="'Segoe UI', sans-serif">${esc(label)}</text>
  <line x1="${signatureX - 10}" y1="${y + 6}" x2="${signatureX + 360}" y2="${y + 6}" stroke="#94a3b8" stroke-width="1.2"/>
  <text x="${signatureX}" y="${y - 6}" font-size="30" fill="#0f172a" font-family="'Segoe Script', 'Brush Script MT', 'Segoe Print', cursive">${esc(value)}</text>`;
}

function renderEyeChartMini(x: number, y: number): string {
  return `<image href="${MFC_EYE_CHART_DATA_URI}" x="${x}" y="${y}" width="126" height="186" preserveAspectRatio="xMidYMid meet"/>`;
}

function renderResultBadge(x: number, y: number, width: number, height: number, value: string): string {
  const text = wrapText(String(value || "ALL GOOD").toUpperCase(), 12);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#eef8df" stroke="#5a8d37" stroke-width="1.2"/>
    ${textLines(x + width / 2, y + height / 2 + 6 - ((text.length - 1) * 11), text, {
      size: 14,
      weight: 800,
      color: "#2e5d1c",
      lineHeight: 18,
      anchor: "middle",
    })}
  `;
}

export function renderMfcSvg(input: Record<string, unknown>, pageNumber?: 1 | 2): string {
  const fields = applicantFields(input);
  const fieldMap = Object.fromEntries(fields) as Record<string, string>;
  const bloodLines = wrapText(
    String(
      input.bloodTest ??
        "Red blood Cells (RBC)- 4.35 to 5.65(Man),3.92 to 5.13(Women)\nWhite Blood Cells (WBC)- 4500-11000/mm3\nPlatelets (PLT): 152 to 361",
    ),
    48,
  );
  const mriLines = wrapText(
    String(
      input.mriTest ??
        "1. Extensive tissue loss in the right temporal/occipital region with ex vacuo prominence of the right lateral ventricle and Wallerian degeneration of the right cerebral peduncle.\n2. Subtle focal defects of periventricular white matter probably due to superimposed small vessel ischemic disease.\n3. Previous studies are kept from being made available for review. At such time that a previous study becomes available, an addendum will be issued.",
    ),
    47,
  );
  const eyeLines = wrapText(String(input.eyeTest ?? "Successfully Read All the Text In This Chart"), 58);
  const summaryLines = wrapText(
    String(
      input.finalSummary ??
        "I have examined and certified that he is free from deafness or any other infirmity, mental or physical, likely to interfere with the efficiency of his work and found to possess good health.",
    ),
    72,
  );
  const bloodHeight = Math.max(118, bloodLines.length * 20 + 42);
  const mriHeight = Math.max(228, mriLines.length * 18 + 56);
  const eyeHeight = Math.max(222, eyeLines.length * 18 + 128);
  const canvasWidth = 860;
  const pageWidth = 760;
  const pageX = 50;
  const page1Y = 26;
  const pageGap = 34;
  const marginX = pageX + 44;
  const photoX = pageX + 548;
  const photoY = page1Y + 144;
  const photoW = 142;
  const photoH = 158;
  const tableX = marginX;
  const tableY = page1Y + 476;
  const tableW = 640;
  const resultColW = 118;
  const contentColW = tableW - resultColW;
  const resultX = tableX + contentColW;
  const totalTableHeight = 42 + bloodHeight + mriHeight + eyeHeight;
  const photoUrl = String(input.sourceAttachmentUrl ?? "");
  const officerName = String(input.officerName ?? "N/a");
  const officerSignature = String(input.officerSignature ?? "N/a");
  const tableBottom = tableY + totalTableHeight;
  const signatureY = tableBottom + 48;
  const page1Height = signatureY - page1Y + 54;
  const page2Y = page1Y + page1Height + pageGap;
  const headerTop = page1Y + 36;
  const secondPageHeaderTop = page2Y + 36;
  const secondPhotoY = page2Y + 168;
  const secondPhotoW = 138;
  const secondPhotoH = 154;
  const page2FieldStartY = page2Y + 206;
  const page2FieldGap = 36;
  const page2LastFieldY = page2FieldStartY + page2FieldGap * 7;
  const descriptionY = page2Y + 502;
  const descriptionTextY = descriptionY + 2;
  const descriptionBlockHeight = Math.max(96, summaryLines.length * 22 + 8);
  const officerNameY = descriptionY + descriptionBlockHeight + 52;
  const officerSignatureY = officerNameY + 42;
  const page2BottomY = officerSignatureY + 24;
  const page2Height = page2BottomY - page2Y + 70;
  const combinedRootHeight = page2Y + page2Height + pageGap;
  const rootWidth = pageNumber ? pageWidth : canvasWidth;
  const rootHeight = pageNumber ? (pageNumber === 1 ? page1Height : page2Height) : combinedRootHeight;
  const viewBox = pageNumber
    ? `${pageX} ${pageNumber === 1 ? page1Y : page2Y} ${pageWidth} ${pageNumber === 1 ? page1Height : page2Height}`
    : `0 0 ${canvasWidth} ${combinedRootHeight}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${rootWidth}" height="${rootHeight}" viewBox="${viewBox}">
  <rect width="${canvasWidth}" height="${combinedRootHeight}" fill="#ffffff"/>
  <rect x="${pageX}" y="${page1Y}" width="${pageWidth}" height="${page1Height}" fill="#ffffff"/>
  <rect x="${pageX}" y="${page2Y}" width="${pageWidth}" height="${page2Height}" fill="#ffffff"/>

  <line x1="${pageX + 26}" y1="${headerTop}" x2="${pageX + pageWidth - 26}" y2="${headerTop}" stroke="#444" stroke-width="1"/>
  ${renderMountZonahMark(pageX + 42, headerTop + 6, 52)}
  ${renderMountZonahMark(pageX + pageWidth - 94, headerTop + 6, 52)}
  <text x="${pageX + pageWidth / 2}" y="${headerTop + 30}" text-anchor="middle" font-size="31" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">MOUNT ZONAH</text>
  <text x="${pageX + pageWidth / 2}" y="${headerTop + 68}" text-anchor="middle" font-size="17" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">MEDICAL FITNESS CERTIFICATE</text>
  <line x1="${pageX + 26}" y1="${headerTop + 84}" x2="${pageX + pageWidth - 26}" y2="${headerTop + 84}" stroke="#444" stroke-width="1"/>

  <text x="${pageX + pageWidth / 2}" y="${page1Y + 146}" text-anchor="middle" font-size="18" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">Applicant Information</text>

  <text x="${marginX}" y="${page1Y + 188}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Name:</text>
  <text x="${marginX}" y="${page1Y + 222}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Sex:</text>
  <text x="${marginX}" y="${page1Y + 256}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">D.O.B:</text>
  <text x="${marginX}" y="${page1Y + 290}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">CID:</text>
  <text x="${marginX}" y="${page1Y + 324}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Number:</text>
  <text x="${marginX}" y="${page1Y + 358}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Weight:</text>
  <text x="${marginX}" y="${page1Y + 392}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">MFC Reason:</text>
  <text x="${marginX}" y="${page1Y + 426}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Date:</text>

  <text x="${marginX + 84}" y="${page1Y + 188}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["Name"])}</text>
  <text x="${marginX + 84}" y="${page1Y + 222}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["Sex"])}</text>
  <text x="${marginX + 84}" y="${page1Y + 256}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["D.O.B"])}</text>
  <text x="${marginX + 84}" y="${page1Y + 290}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["CID"])}</text>
  <text x="${marginX + 84}" y="${page1Y + 324}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["Number"])}</text>
  <text x="${marginX + 84}" y="${page1Y + 358}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["Weight"])}</text>
  <text x="${marginX + 84}" y="${page1Y + 392}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["MFC Reason"])}</text>
  <text x="${marginX + 84}" y="${page1Y + 426}" font-size="14" fill="#111827" font-family="'Times New Roman', serif">${esc(fieldMap["Date"])}</text>

  ${renderPhotoFrame(photoX, photoY, photoW, photoH, photoUrl)}

  <line x1="${marginX}" y1="${page1Y + 454}" x2="${pageX + pageWidth - 44}" y2="${page1Y + 454}" stroke="#444" stroke-width="1"/>
  <text x="${marginX}" y="${page1Y + 484}" font-size="18" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">Test Reports:</text>

  <rect x="${tableX}" y="${tableY}" width="${tableW}" height="${totalTableHeight}" fill="none" stroke="#111827" stroke-width="1.4"/>
  <line x1="${resultX}" y1="${tableY}" x2="${resultX}" y2="${tableY + totalTableHeight}" stroke="#111827" stroke-width="1.2"/>
  <line x1="${tableX}" y1="${tableY + 34}" x2="${tableX + tableW}" y2="${tableY + 34}" stroke="#111827" stroke-width="1.2"/>
  <text x="${tableX + 12}" y="${tableY + 23}" font-size="14" font-weight="700" fill="#4f74d6" font-family="'Times New Roman', serif">Report Title</text>
  <text x="${resultX + resultColW / 2}" y="${tableY + 23}" text-anchor="middle" font-size="14" font-weight="700" fill="#4f74d6" font-family="'Times New Roman', serif">Result</text>
  <line x1="${tableX}" y1="${tableY + 34 + bloodHeight}" x2="${tableX + tableW}" y2="${tableY + 34 + bloodHeight}" stroke="#111827" stroke-width="1.1"/>
  <line x1="${tableX}" y1="${tableY + 34 + bloodHeight + mriHeight}" x2="${tableX + tableW}" y2="${tableY + 34 + bloodHeight + mriHeight}" stroke="#111827" stroke-width="1.1"/>

  <text x="${tableX + 12}" y="${tableY + 58}" font-size="16" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">Blood Test:</text>
  ${textLines(tableX + 16, tableY + 82, bloodLines, { size: 12, color: "#111827", lineHeight: 18 })}
  ${renderResultBadge(resultX + 8, tableY + 34 + (bloodHeight / 2) - 18, resultColW - 16, 36, String(input.bloodResult ?? "ALL GOOD"))}

  <text x="${tableX + 12}" y="${tableY + 34 + bloodHeight + 26}" font-size="16" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">MRI Test:</text>
  ${textLines(tableX + 16, tableY + 34 + bloodHeight + 50, mriLines, { size: 11.5, color: "#111827", lineHeight: 17 })}
  ${renderResultBadge(resultX + 8, tableY + 34 + bloodHeight + (mriHeight / 2) + 8, resultColW - 16, 36, String(input.mriResult ?? "ALL GOOD"))}

  <text x="${tableX + 12}" y="${tableY + 34 + bloodHeight + mriHeight + 24}" font-size="16" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">Eye Test:</text>
  ${renderEyeChartMini(tableX + 42, tableY + 34 + bloodHeight + mriHeight + 54)}
  ${textLines(tableX + 16, tableY + 34 + bloodHeight + mriHeight + 214, eyeLines, { size: 11.5, color: "#111827", lineHeight: 16 })}
  ${renderResultBadge(resultX + 8, tableY + 34 + bloodHeight + mriHeight + (eyeHeight / 2) + 2, resultColW - 16, 36, String(input.eyeResult ?? "ALL GOOD"))}

  <text x="${marginX}" y="${signatureY}" font-size="14" font-weight="700" fill="#2563eb" text-decoration="underline" font-family="'Times New Roman', serif">Signature of Medical Officer:</text>
  <text x="${marginX + 216}" y="${signatureY - 2}" font-size="24" fill="#111827" font-family="'Segoe Script', 'Brush Script MT', cursive">${esc(officerSignature)}</text>
  <line x1="${marginX + 205}" y1="${signatureY + 6}" x2="${marginX + 420}" y2="${signatureY + 6}" stroke="#94a3b8" stroke-width="1"/>

  <line x1="${pageX + 26}" y1="${secondPageHeaderTop}" x2="${pageX + pageWidth - 26}" y2="${secondPageHeaderTop}" stroke="#444" stroke-width="1"/>
  ${renderMountZonahMark(pageX + 42, secondPageHeaderTop + 6, 52)}
  ${renderMountZonahMark(pageX + pageWidth - 94, secondPageHeaderTop + 6, 52)}
  <text x="${pageX + pageWidth / 2}" y="${secondPageHeaderTop + 30}" text-anchor="middle" font-size="31" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">MOUNT ZONAH</text>
  <text x="${pageX + pageWidth / 2}" y="${secondPageHeaderTop + 68}" text-anchor="middle" font-size="17" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">MEDICAL FITNESS CERTIFICATE</text>
  <line x1="${pageX + 26}" y1="${secondPageHeaderTop + 84}" x2="${pageX + pageWidth - 26}" y2="${secondPageHeaderTop + 84}" stroke="#444" stroke-width="1"/>
  <text x="${pageX + pageWidth / 2}" y="${page2Y + 158}" text-anchor="middle" font-size="18" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">Applicant Information</text>

  <text x="${pageX + 58}" y="${page2FieldStartY}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Name: ${esc(fieldMap["Name"])}</text>
  <text x="${pageX + 58}" y="${page2FieldStartY + page2FieldGap}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Sex: ${esc(fieldMap["Sex"])}</text>
  <text x="${pageX + 58}" y="${page2FieldStartY + page2FieldGap * 2}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">D.O.B: ${esc(fieldMap["D.O.B"])}</text>
  <text x="${pageX + 58}" y="${page2FieldStartY + page2FieldGap * 3}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">CID: ${esc(fieldMap["CID"])}</text>
  <text x="${pageX + 58}" y="${page2FieldStartY + page2FieldGap * 4}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Number: ${esc(fieldMap["Number"])}</text>
  <text x="${pageX + 58}" y="${page2FieldStartY + page2FieldGap * 5}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Weight: ${esc(fieldMap["Weight"])}</text>
  <text x="${pageX + 58}" y="${page2FieldStartY + page2FieldGap * 6}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">MFC Reason: ${esc(fieldMap["MFC Reason"])}</text>
  <text x="${pageX + 58}" y="${page2LastFieldY}" font-size="14" font-weight="700" fill="#111827" font-family="'Times New Roman', serif">Date: ${esc(fieldMap["Date"])}</text>
  ${renderPhotoFrame(pageX + 506, secondPhotoY, secondPhotoW, secondPhotoH, photoUrl)}

  <text x="${pageX + 58}" y="${descriptionY}" font-size="16" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">Description:</text>
  ${textLines(pageX + 182, descriptionTextY, summaryLines, { size: 14, weight: 700, color: "#111827", lineHeight: 22 })}

  <text x="${pageX + 58}" y="${officerNameY}" font-size="16" font-weight="800" fill="#2563eb" text-decoration="underline" font-family="'Times New Roman', serif">Name of Medical Officer:</text>
  <text x="${pageX + 286}" y="${officerNameY}" font-size="16" font-weight="800" fill="#111827" font-family="'Times New Roman', serif">${esc(officerName)}</text>
  <text x="${pageX + 58}" y="${officerSignatureY}" font-size="16" font-weight="800" fill="#2563eb" text-decoration="underline" font-family="'Times New Roman', serif">Signature of Medical Officer:</text>
  <text x="${pageX + 318}" y="${officerSignatureY - 3}" font-size="24" fill="#111827" font-family="'Segoe Script', 'Brush Script MT', cursive">${esc(officerSignature)}</text>
</svg>`;
}

export function renderPrescriptionSvg(input: Record<string, unknown>, medicineLines: string[]): string {
  const details = [
    `Patient: ${String(input.patientName ?? "")}`,
    `CID: ${String(input.cid ?? "")}`,
    `Age: ${String(input.age ?? "")}`,
    `Sex: ${String(input.sex ?? "")}`,
    `Weight: ${String(input.weight ?? "")}`,
    `Date: ${String(input.prescriptionDateText ?? "")}`,
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1900" viewBox="0 0 1400 1900">
  <rect width="1400" height="1900" fill="#faf8f3"/>
  <rect width="1400" height="1900" fill="url(#paperLines)" opacity="0.92"/>
  <defs>
    <pattern id="paperLines" width="1400" height="40" patternUnits="userSpaceOnUse">
      <rect width="1400" height="40" fill="#fdfcf9"/>
      <line x1="0" y1="39" x2="1400" y2="39" stroke="#5aa8ff" stroke-width="1.2" opacity="0.55"/>
      <line x1="96" y1="0" x2="96" y2="1900" stroke="#ff5f86" stroke-width="2" opacity="0.55"/>
    </pattern>
  </defs>
  <text x="700" y="110" text-anchor="middle" font-size="44" font-weight="700" fill="#111827" font-family="'Comic Sans MS', 'Segoe Print', cursive">~MOUNT ZONAH MEDICAL HOSPITAL~</text>
  ${linesBlock(details, 190, 44)}
  <text x="120" y="520" font-size="24" font-weight="700" fill="#111827" font-family="'Segoe Print', cursive">Hx / Findings:</text>
  ${linesBlock([String(input.symptoms ?? ""), String(input.findings ?? "")], 560, 38)}
  <text x="120" y="760" font-size="24" font-weight="700" fill="#111827" font-family="'Segoe Print', cursive">Rx:</text>
  ${linesBlock(medicineLines, 810, 38)}
  <text x="120" y="1200" font-size="24" font-weight="700" fill="#111827" font-family="'Segoe Print', cursive">Advice:</text>
  ${linesBlock([String(input.advice ?? ""), String(input.followUp ?? "")], 1240, 38)}
  <text x="900" y="1740" font-size="24" fill="#111827" font-family="'Segoe Print', cursive">Dr. Signature: ${esc(String(input.signatureText ?? ""))}</text>
</svg>`;
}

export function renderMedicalRecordSvg(input: Record<string, unknown>): string {
  const lines = [
    `Name: ${String(input.patientName ?? "")}`,
    `CID: ${String(input.cid ?? "")}`,
    `Phone Number: ${String(input.phone ?? "")}`,
    `Details of injury: ${String(input.injuryDetails ?? "")}`,
    `Treatment Details: ${String(input.treatmentDetails ?? "")}`,
    `Date: ${String(input.recordDateText ?? "")}`,
    `Done By: ${String(input.doneByText ?? "")}`,
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1600" viewBox="0 0 1400 1600">
  <rect width="1400" height="1600" fill="#101720"/>
  <rect x="60" y="60" width="1280" height="1480" rx="24" fill="#1a1208" opacity="0.98"/>
  <text x="120" y="150" font-size="42" fill="#f8fafc" font-weight="700" font-family="'Segoe UI', sans-serif">Medical Record History</text>
  ${linesBlock(lines, 250, 60)}
</svg>`;
}
