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
  const scale = size / 100;
  return `<g transform="translate(${x}, ${y}) scale(${scale})">
    <path d="M50 10 58 33 82 18 68 40 92 50 68 60 82 82 58 67 50 90 42 67 18 82 32 60 8 50 32 40 18 18 42 33Z" fill="#9fe3ff" stroke="#0d6db8" stroke-width="3"/>
    <circle cx="50" cy="50" r="12" fill="#fff" stroke="#0d6db8" stroke-width="3"/>
  </g>`;
}

function renderPhotoFrame(x: number, y: number, width: number, height: number, imageUrl: string): string {
  const safeUrl = esc(imageUrl);
  if (safeUrl) {
    return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#fff" stroke="#111827" stroke-width="2"/>
    <image href="${safeUrl}" x="${x + 8}" y="${y + 8}" width="${width - 16}" height="${height - 16}" preserveAspectRatio="xMidYMid slice"/>
    `;
  }
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#fff" stroke="#111827" stroke-width="2"/>
    <circle cx="${x + width / 2}" cy="${y + height / 2}" r="66" fill="none" stroke="#111827" stroke-width="6"/>
    <rect x="${x + width / 2 - 42}" y="${y + height / 2 - 26}" width="84" height="52" fill="none" stroke="#111827" stroke-width="6"/>
    <path d="M${x + width / 2 - 28} ${y + height / 2 + 20}l20-28 16 16 10-12 20 24" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x + width / 2 + 18}" cy="${y + height / 2 - 8}" r="7" fill="#111827"/>
    <path d="M${x + width / 2 + 12} ${y + height / 2 + 42}h28M${x + width / 2 + 26} ${y + height / 2 + 28}v28" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
  `;
}

export function renderMfcSvg(input: Record<string, unknown>): string {
  const fields = applicantFields(input);
  const bloodLines = wrapText(
    String(
      input.bloodTest ??
        "Red blood Cells (RBC)- 4.35 to 5.65(Man),3.92 to 5.13(Women)\nWhite Blood Cells (WBC)- 4500-11000/mm3\nPlatelets (PLT): 152 to 361",
    ),
    58,
  );
  const mriLines = wrapText(
    String(
      input.mriTest ??
        "1. Extensive tissue loss in the right temporal/occipital region with ex vacuo prominence of the right lateral ventricle and Wallerian degeneration of the right cerebral peduncle.\n2. Subtle focal defects of periventricular white matter probably due to superimposed small vessel ischemic disease.\n3. Previous studies are kept from being made available for review. At such time that a previous study becomes available, an addendum will be issued.",
    ),
    58,
  );
  const eyeLines = wrapText(String(input.eyeTest ?? "Successfully Read All the Text In This Chart"), 58);
  const summaryLines = wrapText(
    String(
      input.finalSummary ??
        "I have examined and certified that he is free from deafness or any other infirmity, mental or physical, likely to interfere with the efficiency of his work and found to possess good health.",
    ),
    94,
  );
  const bloodHeight = Math.max(168, bloodLines.length * 32 + 68);
  const mriHeight = Math.max(280, mriLines.length * 32 + 68);
  const eyeHeight = Math.max(132, eyeLines.length * 32 + 68);
  const resultX = 1068;
  const contentX = 108;
  const tableWidth = 1160;
  const page2Top = 1320;
  const bloodTop = 530;
  const mriTop = bloodTop + bloodHeight;
  const eyeTop = mriTop + mriHeight;
  const totalTableHeight = bloodHeight + mriHeight + eyeHeight;
  const photoUrl = String(input.sourceAttachmentUrl ?? "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="2520" viewBox="0 0 1400 2520">
  <rect width="1400" height="2520" fill="#ece7dc"/>
  <rect x="56" y="50" width="1288" height="1180" fill="#fffef9" stroke="#111827" stroke-width="2.6"/>
  <rect x="56" y="${page2Top}" width="1288" height="1140" fill="#fffef9" stroke="#111827" stroke-width="2.6"/>

  ${renderMountZonahMark(176, 132, 84)}
  ${renderMountZonahMark(1138, 132, 84)}
  <text x="700" y="132" text-anchor="middle" font-size="44" font-weight="800" letter-spacing="8" fill="#111827" font-family="'Times New Roman', serif">MOUNT ZONAH</text>
  <text x="700" y="184" text-anchor="middle" font-size="28" font-weight="700" letter-spacing="4" fill="#111827" font-family="'Times New Roman', serif">MEDICAL FITNESS CERTIFICATE</text>
  <text x="108" y="248" font-size="28" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">Applicant Information</text>
  ${renderApplicantColumn(fields, 108, 314)}
  ${renderPhotoFrame(875, 286, 250, 250, photoUrl)}

  <text x="108" y="498" font-size="26" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">Test Reports:</text>
  <rect x="108" y="530" width="${tableWidth}" height="${totalTableHeight}" fill="none" stroke="#111827" stroke-width="1.6"/>
  <line x1="${resultX}" y1="530" x2="${resultX}" y2="${530 + totalTableHeight}" stroke="#111827" stroke-width="1.4"/>
  <line x1="108" y1="584" x2="${108 + tableWidth}" y2="584" stroke="#111827" stroke-width="1.4"/>
  <text x="150" y="565" font-size="20" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">Report Title</text>
  <text x="${resultX + 90}" y="565" text-anchor="middle" font-size="20" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">Result</text>

  <line x1="108" y1="${bloodTop + bloodHeight}" x2="${108 + tableWidth}" y2="${bloodTop + bloodHeight}" stroke="#111827" stroke-width="1.2"/>
  <line x1="108" y1="${mriTop + mriHeight}" x2="${108 + tableWidth}" y2="${mriTop + mriHeight}" stroke="#111827" stroke-width="1.2"/>

  <text x="${contentX}" y="${bloodTop + 34}" font-size="20" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">Blood Test:</text>
  ${textLines(contentX + 18, bloodTop + 74, bloodLines, { size: 18, color: "#1f2937", lineHeight: 30 })}
  ${textLines(resultX + 90, bloodTop + bloodHeight / 2, wrapText(String(input.bloodResult ?? "ALL GOOD"), 12), { size: 20, color: "#166534", weight: 800, lineHeight: 28, anchor: "middle" })}

  <text x="${contentX}" y="${mriTop + 34}" font-size="20" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">MRI Test:</text>
  ${textLines(contentX + 18, mriTop + 74, mriLines, { size: 18, color: "#1f2937", lineHeight: 30 })}
  ${textLines(resultX + 90, mriTop + mriHeight / 2, wrapText(String(input.mriResult ?? "ALL GOOD"), 12), { size: 20, color: "#166534", weight: 800, lineHeight: 28, anchor: "middle" })}

  <text x="${contentX}" y="${eyeTop + 34}" font-size="20" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">Eye Test:</text>
  ${textLines(contentX + 18, eyeTop + 74, eyeLines, { size: 18, color: "#1f2937", lineHeight: 30 })}
  ${textLines(resultX + 90, eyeTop + eyeHeight / 2, wrapText(String(input.eyeResult ?? "ALL GOOD"), 12), { size: 20, color: "#166534", weight: 800, lineHeight: 28, anchor: "middle" })}

  <text x="108" y="1180" font-size="22" fill="#111827" font-family="'Segoe UI', sans-serif">Signature of Medical Officer: ${esc(String(input.officerSignature ?? "N/a"))}</text>

  ${renderMountZonahMark(176, page2Top + 82, 84)}
  ${renderMountZonahMark(1138, page2Top + 82, 84)}
  <text x="700" y="${page2Top + 82}" text-anchor="middle" font-size="44" font-weight="800" letter-spacing="8" fill="#111827" font-family="'Times New Roman', serif">MOUNT ZONAH</text>
  <text x="700" y="${page2Top + 134}" text-anchor="middle" font-size="28" font-weight="700" letter-spacing="4" fill="#111827" font-family="'Times New Roman', serif">MEDICAL FITNESS CERTIFICATE</text>
  <text x="108" y="${page2Top + 198}" font-size="28" font-weight="700" fill="#111827" font-family="'Segoe UI', sans-serif">Applicant Information</text>
  ${renderApplicantColumn(fields, 108, page2Top + 264)}
  ${renderPhotoFrame(875, page2Top + 236, 250, 250, photoUrl)}

  ${textLines(108, page2Top + 590, wrapText(`Description: ${String(input.finalSummary ?? "N/a")}`, 100), { size: 22, color: "#1f2937", lineHeight: 34 })}
  <text x="108" y="${page2Top + 834}" font-size="22" fill="#111827" font-family="'Segoe UI', sans-serif">Name of Medical Officer: ${esc(String(input.officerName ?? "N/a"))}</text>
  <text x="108" y="${page2Top + 894}" font-size="22" fill="#111827" font-family="'Segoe UI', sans-serif">Signature of Medical Officer: ${esc(String(input.officerSignature ?? "N/a"))}</text>
  <text x="108" y="${page2Top + 1060}" font-size="18" fill="#64748b" font-family="'Segoe UI', sans-serif">Generated by Legacy BD EMS Doctor Portal</text>
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
