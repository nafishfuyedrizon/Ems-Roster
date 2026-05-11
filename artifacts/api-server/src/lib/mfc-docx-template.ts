import { access, readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const TEMPLATE_FILENAME = "medical-fitness-certificate-template.docx";
const TEMPLATE_PATH_CANDIDATES = [
  path.resolve(import.meta.dirname, "../templates", TEMPLATE_FILENAME),
  path.resolve(import.meta.dirname, "../../templates", TEMPLATE_FILENAME),
  path.resolve(process.cwd(), "templates", TEMPLATE_FILENAME),
  path.resolve(process.cwd(), "artifacts/api-server/templates", TEMPLATE_FILENAME),
];
const PHOTO_ENTRY_PATH = "word/media/image2.png";
const TEXT_NODE_PATTERN = /<w:t\b[^>]*>[\s\S]*?<\/w:t>/g;

const TEXT_NODE_INDEX = {
  applicantNamePage1: 5,
  sexPage1: 7,
  dobPage1: 9,
  cidPage1: 11,
  numberPage1: 13,
  weightPage1: 15,
  reasonPage1: 17,
  datePage1: 19,
  bloodLine1: 26,
  bloodLine2: 27,
  bloodLine3: 28,
  bloodResult: 30,
  mriLine1: 33,
  mriLine2: 34,
  mriLine3: 35,
  mriLine4: 36,
  mriLine5: 37,
  mriLine6: 38,
  mriLine7: 39,
  mriLine8: 40,
  mriLine9: 41,
  mriResult: 42,
  eyeLine1: 44,
  eyeLine2: 45,
  eyeLine3: 46,
  eyeResult: 47,
  signaturePage1: 51,
  applicantNamePage2: 57,
  sexPage2: 59,
  dobPage2: 61,
  cidPage2: 63,
  numberPage2: 65,
  weightPage2: 67,
  reasonPage2: 69,
  datePage2: 71,
  description: 74,
  officerNamePage2: 76,
  signaturePage2: 80,
} as const;

const DEFAULT_BLOOD_LINES = [
  "Red blood Cells (RBC)- 4.35 to 5.65(Man),3.92 to 5.13(Women)",
  "White Blood Cells (WBC)- 4500-11000/mm3",
  "Platelets (PLT): 152 to 361",
];

const DEFAULT_MRI_LINES = [
  "1. Extensive tissue loss in the right temporal/occipital region",
  "with ex vacuo prominence of the right lateral ventricle and",
  "Wallerian degeneration of the right cerebral peduncle.",
  "2. Subtle focal defects of periventricular white matter probably",
  "due",
  "to superimposed small vessel ischemic disease.",
  "3. Previous studies are kept from being made available for",
  "review. At such time that a previous study becomes available,",
  "an addendum will be issued.",
];

const DEFAULT_EYE_LINES = ["Successfully Read All the Text", "In", "This Chart"];
const DEFAULT_DESCRIPTION =
  "I have examined and certified that he is free from deafness or any other infirmity, mental or physical, likely to interfere with the efficiency of his work and found to possess good health.";

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeField(value: unknown, fallback = "N/a") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function normalizeResult(value: unknown) {
  return normalizeField(value, "ALL GOOD").toUpperCase();
}

function splitIntoSlots(value: unknown, slotCount: number, defaults: string[]) {
  const raw = String(value ?? "").trim();
  const source = raw
    ? raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : defaults;
  const lines = source.slice(0, slotCount);
  while (lines.length < slotCount) lines.push("");
  return lines;
}

function replaceTextNodes(xml: string, replacements: Map<number, string>) {
  let matchIndex = 0;
  return xml.replace(TEXT_NODE_PATTERN, (fullMatch) => {
    const replacement = replacements.get(matchIndex);
    matchIndex += 1;
    if (replacement === undefined) return fullMatch;
    return fullMatch.replace(/>([\s\S]*?)</, `>${xmlEscape(replacement)}<`);
  });
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) throw new Error("Invalid data URL.");
  return Buffer.from(match[2], "base64");
}

async function fetchRemoteBuffer(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Image fetch failed with status ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function resolveSourcePhotoBuffer(url: unknown) {
  const normalized = String(url ?? "").trim();
  if (!normalized) return null;
  if (normalized.startsWith("data:")) return dataUrlToBuffer(normalized);
  return fetchRemoteBuffer(normalized);
}

async function buildTemplatePortrait(url: unknown) {
  let source: Buffer | null = null;
  try {
    source = await resolveSourcePhotoBuffer(url);
  } catch (error) {
    console.warn("[MFC-DOCX] Could not resolve source photo for template portrait.", error);
    return null;
  }
  if (!source) return null;

  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const width = 720;
  const height = 900;
  const inset = 28;
  const subjectWidth = width - inset * 2;
  const subjectHeight = height - inset * 2;

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#d9d6cf",
    },
  })
    .composite([
      {
        input: {
          create: {
            width: 140,
            height: height - inset * 2,
            channels: 4,
            background: "#cec9c1",
          },
        },
        left: inset,
        top: inset,
      },
      {
        input: {
          create: {
            width: 4,
            height: height - inset * 2,
            channels: 4,
            background: "#b6b0a7",
          },
        },
        left: inset + 134,
        top: inset,
      },
      {
        input: {
          create: {
            width: 80,
            height: 56,
            channels: 4,
            background: "#efd3cf",
          },
        },
        left: inset + 28,
        top: Math.round(height * 0.46),
      },
      {
        input: {
          create: {
            width: 220,
            height: 52,
            channels: 4,
            background: "#445f98",
          },
        },
        left: width - inset - 220,
        top: height - inset - 86,
      },
      {
        input: await sharp(source)
          .resize({
            width: subjectWidth,
            height: subjectHeight,
            fit: "contain",
            position: "south",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer(),
        left: inset,
        top: inset,
      },
    ])
    .png()
    .toBuffer();
}

async function readTemplateBuffer() {
  for (const candidate of TEMPLATE_PATH_CANDIDATES) {
    try {
      await access(candidate);
      return await readFile(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(
    `MFC DOCX template not found. Checked: ${TEMPLATE_PATH_CANDIDATES.join(" | ")}`,
  );
}

function buildDocumentXml(input: Record<string, unknown>, originalXml: string) {
  const bloodLines = splitIntoSlots(input.bloodTest, 3, DEFAULT_BLOOD_LINES);
  const mriLines = splitIntoSlots(input.mriTest, 9, DEFAULT_MRI_LINES);
  const eyeLines = splitIntoSlots(input.eyeTest, 3, DEFAULT_EYE_LINES);
  const replacements = new Map<number, string>([
    [TEXT_NODE_INDEX.applicantNamePage1, normalizeField(input.applicantName)],
    [TEXT_NODE_INDEX.sexPage1, normalizeField(input.sex)],
    [TEXT_NODE_INDEX.dobPage1, normalizeField(input.dateOfBirth)],
    [TEXT_NODE_INDEX.cidPage1, normalizeField(input.cid)],
    [TEXT_NODE_INDEX.numberPage1, normalizeField(input.number)],
    [TEXT_NODE_INDEX.weightPage1, normalizeField(input.weight)],
    [TEXT_NODE_INDEX.reasonPage1, normalizeField(input.mfcReason)],
    [TEXT_NODE_INDEX.datePage1, normalizeField(input.examDateText)],
    [TEXT_NODE_INDEX.bloodLine1, bloodLines[0]],
    [TEXT_NODE_INDEX.bloodLine2, bloodLines[1]],
    [TEXT_NODE_INDEX.bloodLine3, bloodLines[2]],
    [TEXT_NODE_INDEX.bloodResult, normalizeResult(input.bloodResult)],
    [TEXT_NODE_INDEX.mriLine1, mriLines[0]],
    [TEXT_NODE_INDEX.mriLine2, mriLines[1]],
    [TEXT_NODE_INDEX.mriLine3, mriLines[2]],
    [TEXT_NODE_INDEX.mriLine4, mriLines[3]],
    [TEXT_NODE_INDEX.mriLine5, mriLines[4]],
    [TEXT_NODE_INDEX.mriLine6, mriLines[5]],
    [TEXT_NODE_INDEX.mriLine7, mriLines[6]],
    [TEXT_NODE_INDEX.mriLine8, mriLines[7]],
    [TEXT_NODE_INDEX.mriLine9, mriLines[8]],
    [TEXT_NODE_INDEX.mriResult, normalizeResult(input.mriResult)],
    [TEXT_NODE_INDEX.eyeLine1, eyeLines[0]],
    [TEXT_NODE_INDEX.eyeLine2, eyeLines[1]],
    [TEXT_NODE_INDEX.eyeLine3, eyeLines[2]],
    [TEXT_NODE_INDEX.eyeResult, normalizeResult(input.eyeResult)],
    [TEXT_NODE_INDEX.signaturePage1, normalizeField(input.officerSignature)],
    [TEXT_NODE_INDEX.applicantNamePage2, normalizeField(input.applicantName)],
    [TEXT_NODE_INDEX.sexPage2, normalizeField(input.sex)],
    [TEXT_NODE_INDEX.dobPage2, normalizeField(input.dateOfBirth)],
    [TEXT_NODE_INDEX.cidPage2, normalizeField(input.cid)],
    [TEXT_NODE_INDEX.numberPage2, normalizeField(input.number)],
    [TEXT_NODE_INDEX.weightPage2, normalizeField(input.weight)],
    [TEXT_NODE_INDEX.reasonPage2, normalizeField(input.mfcReason)],
    [TEXT_NODE_INDEX.datePage2, normalizeField(input.examDateText)],
    [TEXT_NODE_INDEX.description, normalizeField(input.finalSummary, DEFAULT_DESCRIPTION)],
    [TEXT_NODE_INDEX.officerNamePage2, normalizeField(input.officerName)],
    [TEXT_NODE_INDEX.signaturePage2, normalizeField(input.officerSignature)],
  ]);

  return replaceTextNodes(originalXml, replacements);
}

export async function generateMfcTemplateDocx(input: Record<string, unknown>) {
  const templateBuffer = await readTemplateBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);
  const originalXml = await zip.file("word/document.xml")?.async("string");
  if (!originalXml) {
    throw new Error("Template document.xml not found.");
  }

  zip.file("word/document.xml", buildDocumentXml(input, originalXml));

  const portraitBuffer = await buildTemplatePortrait(input.sourceAttachmentUrl);
  if (portraitBuffer) {
    zip.file(PHOTO_ENTRY_PATH, portraitBuffer);
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}
