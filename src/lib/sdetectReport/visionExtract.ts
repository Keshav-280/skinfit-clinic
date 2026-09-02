import { spawn } from "node:child_process";
import path from "node:path";
import OpenAI from "openai";
import type { SdetectMetric, SdetectPatient } from "./types";
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
];

const IN_DEPTH_LABELS = [
  "Porphyrin",
  "Deep Pigment",
  "Brown pigment",
  "Heat Map of Pigment",
  "Red Map of Sensitivity",
  "Heat Map of Sensitivity",
  "Collagen",
];

const ALL_LABELS = Array.from(
  new Set([...SDETECT_RADAR_LABELS, ...GENERAL_LABELS, ...IN_DEPTH_LABELS])
);

export type VisionExtractResult = {
  patient: Partial<SdetectPatient>;
  classification: string | null;
  moisture: number | null;
  comprehensiveScore: number | null;
  radar: SdetectMetric[];
  generalAnalysis: SdetectMetric[];
  inDepthAnalysis: SdetectMetric[];
  issueAnalysis: string;
  skincareAdvice: string[];
};

/** Rasterise the first pages of the PDF via PyMuPDF (reuses the QR-decode toolchain). */
async function renderPdfPages(pdfBuffer: Buffer): Promise<string[]> {
  const script = path.join(process.cwd(), "scripts/sdetect_render_pdf.py");
  const python = process.env.SDETECT_QR_PYTHON ?? "python3";
  return new Promise((resolve) => {
    const proc = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    proc.on("error", () => resolve([]));
    proc.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim()) as { images?: string[] };
        resolve(Array.isArray(parsed.images) ? parsed.images : []);
      } catch {
        resolve([]);
      }
    });
    proc.stdin.write(pdfBuffer);
    proc.stdin.end();
  });
}

/** Vision OCR model - gpt-4o reads copy/scan PDFs far better than mini. Override with SKINFIT_REPORT_VISION_MODEL. */
function visionModel(): string {
  return process.env.SKINFIT_REPORT_VISION_MODEL?.trim() || "gpt-4o";
}

const RADAR_EXPECTED = SDETECT_RADAR_LABELS.length;
const GENERAL_EXPECTED = GENERAL_LABELS.length;
const IN_DEPTH_EXPECTED = IN_DEPTH_LABELS.length;

/** 0-100 completeness score for a text or vision parse (higher = more fields recovered). */
export function parseConfidenceScore(fields: {
  radarCount: number;
  generalAnalysisCount: number;
  inDepthAnalysisCount: number;
  hasClassification: boolean;
  comprehensiveScore: number;
  patientName: string;
}): number {
  let score = 0;
  score += Math.min(fields.radarCount / RADAR_EXPECTED, 1) * 40;
  score += Math.min(fields.generalAnalysisCount / GENERAL_EXPECTED, 1) * 25;
  score += Math.min(fields.inDepthAnalysisCount / IN_DEPTH_EXPECTED, 1) * 20;
  if (fields.hasClassification) score += 5;
  if (fields.comprehensiveScore > 0) score += 5;
  if (fields.patientName !== "-" && !isGarbledPatientName(fields.patientName)) score += 5;
  return Math.round(score);
}

/** Detect OCR-garbled names (e.g. "J o h n" from broken text extraction). */
export function isGarbledPatientName(name: string): boolean {
  if (name === "-" || !name.trim()) return true;
  const tokens = name.trim().split(/\s+/);
  if (tokens.length < 3) return false;
  const singleChar = tokens.filter((t) => t.length === 1).length;
  return singleChar / tokens.length >= 0.5;
}

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

const VISION_PROMPT = `You are reading a Medixora Bitmoji B3 "Skin Analyzer Report" PDF that has been rendered to images. The source may be a clean print, photocopy, flatbed scan, or phone photo - expect faded text, grey background noise, skew, compression artifacts, and low contrast. Read carefully; focus on small labels, gauge numbers, and table scores even when faint. Extract the raw data exactly as printed. Do NOT invent values - if a field is not legible, use null (for text) or omit the metric.

Metrics often continue onto page 2-3 (radar chart, general analysis tables, in-depth analysis). Read all provided page images.

Return ONLY a JSON object with these keys:
{
  "name": string | null,
  "gender": string | null,
  "age": number | null,
  "phone": string | null,
  "reportDate": string | null,            // e.g. "2026-06-17"
  "scanFrequency": number | null,
  "classification": string | null,        // 4-letter Baumann code e.g. "OSPW"
  "comprehensiveScore": number | null,    // 0-100
  "moisture": number | null,              // percentage number only
  "metrics": { "<parameter name>": number },  // every scored parameter you can read, 0-100
  "issueAnalysis": string | null,         // the "Issue analysis" paragraph, verbatim
  "skincareAdvice": string[]              // each numbered "Skincare advice" item as a separate string
}

Use these canonical parameter names when they appear (match case-insensitively, correct obvious OCR typos): ${ALL_LABELS.join(", ")}.
Return ONLY the JSON, no markdown fences.`;

type RawVision = {
  name?: unknown;
  gender?: unknown;
  age?: unknown;
  phone?: unknown;
  reportDate?: unknown;
  scanFrequency?: unknown;
  classification?: unknown;
  comprehensiveScore?: unknown;
  moisture?: unknown;
  metrics?: unknown;
  issueAnalysis?: unknown;
  skincareAdvice?: unknown;
};

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== "-" ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  const n =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

/** Pull the requested labels out of the model's free-form metrics map. */
function metricsForLabels(
  metricMap: Map<string, number>,
  labels: readonly string[]
): SdetectMetric[] {
  const out: SdetectMetric[] = [];
  for (const label of labels) {
    const score = metricMap.get(normaliseKey(label));
    if (score != null) out.push({ label, score });
  }
  return out;
}

export function isVisionExtractEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Vision-based OCR fallback. Renders the PDF and asks a vision model to read the
 * printed values. Returns null when disabled, rendering fails, or the model
 * cannot be reached - callers keep their text-parsed data in that case.
 */
export async function extractReportWithVision(
  pdfBuffer: Buffer
): Promise<VisionExtractResult | null> {
  const client = getClient();
  if (!client) return null;

  const images = (await renderPdfPages(pdfBuffer)).slice(0, 3);
  if (!images.length) return null;

  let raw: RawVision | null = null;
  try {
    const completion = await client.chat.completions.create({
      model: visionModel(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            ...images.map((b64) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${b64}`, detail: "high" as const },
            })),
          ],
        },
      ],
    });
    const txt = completion.choices[0]?.message?.content;
    if (txt) raw = JSON.parse(txt) as RawVision;
  } catch {
    return null;
  }
  if (!raw) return null;

  const metricMap = new Map<string, number>();
  if (raw.metrics && typeof raw.metrics === "object") {
    for (const [key, value] of Object.entries(raw.metrics as Record<string, unknown>)) {
      const score = asNumber(value);
      if (score != null) metricMap.set(normaliseKey(key), score);
    }
  }

  const classificationRaw = asText(raw.classification);
  const classification = classificationRaw
    ? classificationRaw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || null
    : null;

  return {
    patient: {
      name: asText(raw.name) ?? undefined,
      gender: asText(raw.gender) ?? undefined,
      age: asNumber(raw.age) ?? undefined,
      phone: asText(raw.phone) ?? undefined,
      reportDate: asText(raw.reportDate) ?? undefined,
      scanFrequency: asNumber(raw.scanFrequency) ?? undefined,
    },
    classification,
    moisture: asNumber(raw.moisture),
    comprehensiveScore: asNumber(raw.comprehensiveScore),
    radar: metricsForLabels(metricMap, SDETECT_RADAR_LABELS),
    generalAnalysis: metricsForLabels(metricMap, GENERAL_LABELS),
    inDepthAnalysis: metricsForLabels(metricMap, IN_DEPTH_LABELS),
    issueAnalysis: asText(raw.issueAnalysis) ?? "",
    skincareAdvice: Array.isArray(raw.skincareAdvice)
      ? raw.skincareAdvice.map((s) => asText(s)).filter((s): s is string => Boolean(s))
      : [],
  };
}
