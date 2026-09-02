import type { SdetectMetric, SdetectPatient, SdetectReportData } from "./types";
import { loadPdfJsServer } from "./pdfJsServer";
import { SDETECT_RADAR_LABELS } from "./radarLabels";

const GENERAL_LABELS = [
  "Sebum",
  "Pores",
  "Blackhead",
  "Superficial pigment",
  "Mixed spot",
  "Acne",
  "Skin Barrier",
  "Wrinkle",
] as const;

const IN_DEPTH_LABELS = [
  "Porphyrin",
  "Deep Pigment",
  "Brown pigment",
  "Heat Map of Pigment",
  "Red Map of Sensitivity",
  "Heat Map of Sensitivity",
  "Collagen",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Some Medixora PDFs export text with a space between every glyph
 * (e.g. "N a m e ： K o k i l a"). Word groups are still separated by 2+ spaces.
 */
function normalizePerLetterSpacedText(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return text;

  const singleCharRatio =
    tokens.filter((tok) => [...tok].length === 1).length / tokens.length;
  if (singleCharRatio < 0.3) return text;

  return text
    .split(/\s{2,}/)
    .map((chunk) => chunk.replace(/(?<=\S) (?=\S)/g, ""))
    .join(" ");
}

function findPercentAfterLabel(text: string, label: string): number | null {
  const re = new RegExp(
    `${escapeRegExp(label).replace(/\s+/g, "\\s+")}[^\\d]{0,40}(\\d{1,3})\\s*%`,
    "i"
  );
  const match = text.match(re);
  return match ? Number.parseInt(match[1], 10) : null;
}

function findScoreAfterLabel(text: string, label: string): number | null {
  const percent = findPercentAfterLabel(text, label);
  if (percent != null) return percent;
  const re = new RegExp(
    `${escapeRegExp(label).replace(/\s+/g, "\\s+")}[^\\d]{0,24}(\\d{1,3})(?!\\s*%)`,
    "i"
  );
  const match = text.match(re);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseMetrics(text: string, labels: readonly string[]): SdetectMetric[] {
  const flat = text.replace(/\s+/g, " ");
  const metrics: SdetectMetric[] = [];
  for (const label of labels) {
    const score = findScoreAfterLabel(flat, label);
    if (score != null) metrics.push({ label, score });
  }
  return metrics;
}

function parseSection(text: string, start: string, end?: string | string[]): string {
  const lower = text.toLowerCase();
  const startLower = start.toLowerCase();
  const startIdx = lower.indexOf(startLower);
  if (startIdx < 0) return "";
  let slice = text.slice(startIdx + start.length);
  const endMarkers = end ? (Array.isArray(end) ? end : [end]) : [];
  for (const marker of endMarkers) {
    const endIdx = slice.toLowerCase().indexOf(marker.toLowerCase());
    if (endIdx >= 0) {
      slice = slice.slice(0, endIdx);
      break;
    }
  }
  return cleanNarrativeText(slice);
}

function cleanNarrativeText(text: string): string {
  return text
    .replace(/\d+\s*\/\s*\d+/g, " ")
    .replace(/Note:\s*This report is for clinical reference only[^.]*\.?/gi, "")
    .replace(/Skin Analyzer Report/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePatient(text: string): SdetectPatient {
  const flat = text.replace(/\s+/g, " ");
  const name = flat.match(/Name[：:]\s*([^\t]+?)(?:\s+Gender|$)/)?.[1]?.trim() ?? "-";
  const gender = flat.match(/Gender[：:]\s*(\w+)/i)?.[1] ?? "-";
  const age = Number.parseInt(flat.match(/Age[：:]\s*(\d+)/)?.[1] ?? "0", 10);
  const phone =
    flat.match(/Contact Information[：:]\s*([\d*]+)/)?.[1] ??
    flat.match(/Phone[：:]\s*([\d*]+)/)?.[1] ??
    "-";
  const reportDate =
    flat.match(/Date of report[：:]\s*([\d-]+)/)?.[1] ?? "-";
  const scanFrequency = Number.parseInt(
    flat.match(/Skin Analysis Frequency[：:]\s*(\d+)/)?.[1] ?? "0",
    10
  );
  return { name, gender, age, phone, reportDate, scanFrequency };
}

function parseClassification(text: string): string {
  const match = text.match(
    /Skin Classification\s*([A-Z]{4})|(?:^|\n)\s*([A-Z]{4})\s*\n\s*Skin Classification|([A-Z]{4})\s+Skin Classification/m
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "-";
}

function parseMoisture(text: string): number {
  const match =
    text.match(/Moisture\s*(\d{1,3})\s*%/i) ??
    text.match(/(\d{1,3})\s*%\s*Moisture/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseComprehensiveScore(text: string): number {
  const match =
    text.match(/Comprehensive score\s*(\d{1,3})/i) ??
    text.match(/(\d{1,3})\s+Comprehensive score/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseAdvice(text: string): string[] {
  const block = parseSection(text, "Skincare advice", ["Note:", "Skin Analyzer Report"]);
  if (!block) return [];
  const items: string[] = [];
  const re = /\d+\.\s+([^]+?)(?=\d+\.\s+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    const line = cleanNarrativeText(match[1]);
    if (line) items.push(line);
  }
  return items;
}

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const pdfjs = await loadPdfJsServer();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  }).promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .join(" ");
    parts.push(line);
  }
  await doc.destroy();
  return normalizePerLetterSpacedText(parts.join("\n"));
}

export async function parseSdetectPdfText(
  pdfBuffer: Buffer
): Promise<Omit<SdetectReportData, "faceImages" | "sourceReportUrl" | "reportSn">> {
  const text = await extractPdfText(pdfBuffer);

  const issueAnalysis = parseSection(text, "Issue analysis", [
    "Skincare advice",
    "Note:",
    "Skin Analyzer Report",
  ]);

  return {
    classification: parseClassification(text),
    moisture: parseMoisture(text),
    comprehensiveScore: parseComprehensiveScore(text),
    patient: parsePatient(text),
    radar: parseMetrics(text, SDETECT_RADAR_LABELS),
    issueAnalysis,
    skincareAdvice: parseAdvice(text),
    generalAnalysis: parseMetrics(text, GENERAL_LABELS),
    inDepthAnalysis: parseMetrics(text, IN_DEPTH_LABELS),
  };
}
