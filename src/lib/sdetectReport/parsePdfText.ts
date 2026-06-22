import { PDFParse } from "pdf-parse";
import type { SdetectMetric, SdetectPatient, SdetectReportData } from "./types";

const RADAR_LABELS = [
  "Superficial pigment",
  "Brown pigment",
  "Mixed spot",
  "Collagen",
  "Sebum",
  "Pores",
  "Blackhead",
  "Acne",
  "Heat Map of Sensitivity",
] as const;

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

function parseSection(text: string, start: string, end?: string): string {
  const startIdx = text.indexOf(start);
  if (startIdx < 0) return "";
  const slice = text.slice(startIdx + start.length);
  const endIdx = end ? slice.indexOf(end) : -1;
  return (endIdx >= 0 ? slice.slice(0, endIdx) : slice).trim();
}

function parsePatient(text: string): SdetectPatient {
  const flat = text.replace(/\s+/g, " ");
  const name = flat.match(/Name[：:]\s*([^\t]+?)(?:\s+Gender|$)/)?.[1]?.trim() ?? "—";
  const gender = flat.match(/Gender[：:]\s*(\w+)/i)?.[1] ?? "—";
  const age = Number.parseInt(flat.match(/Age[：:]\s*(\d+)/)?.[1] ?? "0", 10);
  const phone =
    flat.match(/Contact Information[：:]\s*([\d*]+)/)?.[1] ??
    flat.match(/Phone[：:]\s*([\d*]+)/)?.[1] ??
    "—";
  const reportDate =
    flat.match(/Date of report[：:]\s*([\d-]+)/)?.[1] ?? "—";
  const scanFrequency = Number.parseInt(
    flat.match(/Skin Analysis Frequency[：:]\s*(\d+)/)?.[1] ?? "0",
    10
  );
  return { name, gender, age, phone, reportDate, scanFrequency };
}

function parseClassification(text: string): string {
  const match = text.match(
    /Skin Classification\s*([A-Z]{4})|(?:^|\n)\s*([A-Z]{4})\s*\n\s*Skin Classification/m
  );
  return match?.[1] ?? match?.[2] ?? "—";
}

function parseMoisture(text: string): number {
  const match = text.match(/Moisture\s*(\d{1,3})\s*%/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseComprehensiveScore(text: string): number {
  const match = text.match(/Comprehensive score\s*(\d{1,3})/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseAdvice(text: string): string[] {
  const block = parseSection(text, "Skincare advice", "Note:");
  const items: string[] = [];
  const re = /\d+\.\s+([^]+?)(?=\d+\.\s+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    const line = match[1].replace(/\s+/g, " ").trim();
    if (line) items.push(line);
  }
  return items;
}

export async function parseSdetectPdfText(
  pdfBuffer: Buffer
): Promise<Omit<SdetectReportData, "faceImages" | "sourceReportUrl" | "reportSn">> {
  const parser = new PDFParse({ data: pdfBuffer });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = parsed.text ?? "";

  const issueAnalysis = parseSection(text, "Issue analysis", "Skincare advice")
    .replace(/\s+/g, " ")
    .trim();

  return {
    classification: parseClassification(text),
    moisture: parseMoisture(text),
    comprehensiveScore: parseComprehensiveScore(text),
    patient: parsePatient(text),
    radar: parseMetrics(text, RADAR_LABELS),
    issueAnalysis,
    skincareAdvice: parseAdvice(text),
    generalAnalysis: parseMetrics(text, GENERAL_LABELS),
    inDepthAnalysis: parseMetrics(text, IN_DEPTH_LABELS),
  };
}
