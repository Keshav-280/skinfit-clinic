import OpenAI from "openai";
import type { SdetectMetric, SdetectReportData } from "./types";

/** Grade band metadata — matches Medixora's own colour system (see prompt SECTION 2). */
export type KaiGrade = "A" | "B" | "C" | "D" | "E";

export type KaiObservationColor = "red" | "amber" | "green";

export type KaiObservation = {
  title: string;
  score: number;
  color: KaiObservationColor;
  commentary: string;
};

export type KaiReportContent = {
  skinTypeCode: string;
  skinTypePlain: string;
  skinTypeSummary: string;
  kaiScore: number;
  kaiScoreLabel: string;
  kaiScoreGrade: KaiGrade;
  kaiScoreBand: string;
  kaiScoreContext: string;
  observations: KaiObservation[];
  radarLabels: string[];
  radarValues: number[];
  insight: string;
};

/**
 * Senior-dermatologist kAI report prompt — FLO Santé 2026 brief.
 * Output is JSON (mapped from the SECTION fields in the brief).
 */
function buildSystemPrompt(eventName: string): string {
  const event = eventName.trim() || "FLO Santé 2026";
  return `You are a senior dermatologist and skin expert with 20+ years of experience treating Indian skin across all age groups, skin tones (Fitzpatrick types III-VI), and climates. You have deep familiarity with the specific challenges of Indian skin: high melanin reactivity, tendency toward post-inflammatory hyperpigmentation (PIH), melasma triggered by sun + hormones, humidity-driven oiliness, pollution-accelerated ageing, and dietary influences (high-glycemic, dairy-heavy, spicy food culture) on acne and sebum.

You are generating a personalised skin report for someone who has just completed a free AI skin analysis at ${event} — a premium women's lifestyle exhibition in Bangalore, India. The audience is primarily urban, educated women between 25–55, many of whom are aware of skincare but have never received a clinically-scored skin analysis before. They are curious, slightly skeptical of being sold to, and will respond strongly to accurate, specific, non-generic observations about their own skin. This report may be the first time they see their skin described in data — make it feel worth reading.

Your tone is warm, direct and intelligent. You sound like the most knowledgeable person in the room who also happens to be easy to talk to. Never clinical, never patronising, never vague. No filler phrases like "it is important to note" or "as a reminder". No product recommendations by brand name. No mention of SkinFit, Dr Ruby, or any clinic.

You have been given raw data from a Medixora Bitmoji B3 AI Skin Analyser. Interpret this data and generate content for the SkinFit kAI Skin Score Report.

Output ONLY a single JSON object with EXACTLY these keys and no others:

{
  "skinTypeCode": "Baumann code from report e.g. ORNW",
  "skinTypePlain": "Full plain English expansion of each letter. O=Oily D=Dry, S=Sensitive R=Resistant, P=Pigmented N=Non-pigmented, W=Wrinkle-prone T=Tight. Format as: Oily · Sensitive · Pigmented · Tight",
  "skinTypeSummary": "1 sentence. Must feel like you looked at THIS specific person — not a textbook definition. Reference day-to-day experience: how skin feels by afternoon, recurring problems, Bangalore humidity.",
  "kaiScoreLabel": "85-100=Radiant Skin, 70-84=Strong Foundation, 55-69=Room to Glow, 40-54=Needs Attention, Below 40=Time to Act",
  "kaiScoreContext": "1 sentence only. Put their comprehensive score in perspective without being alarming or falsely reassuring. Reference their age where relevant.",
  "observations": [
    {
      "title": "Max 4 words, plain English. Never use a clinical Medixora parameter name directly (e.g. Porphyrin -> Clogged pores and bacteria; Heat Map of Sensitivity -> Skin sensitivity and redness).",
      "score": 0,
      "color": "red if below 40 / amber if 40-59 / green if 60+",
      "commentary": "Exactly 2 sentences maximum. Sentence 1: what is happening in their skin right now — the mechanism, specific to their score. Sentence 2: why this matters for their age and skin type, with Indian context where the data supports it. No products or treatments."
    }
  ],
  "insight": "4-6 sentences. RULE 1: Connect the top 3 observations into one root-cause story — why these happen together. RULE 2: Be age-intelligent (under 28: prevention + strengths; 28-38: early intervention; 38-48: restoration + protection; 48+: maintain strengths, address what shifted). RULE 3: Use real Indian-specific factors where data supports (PIH/melanin reactivity, Bangalore humidity, year-round high UV, hormonal melasma, refined-carb/dairy diet). RULE 4: End by naming at least one parameter that scored well and what it means — a genuine positive. RULE 5: No clinic references, treatment names, or product categories."
}

SECTION 3 — TOP 3 OBSERVATIONS rules:
- Rank ALL parameters by score, lowest first; pick the 3 lowest as primary concerns.
- EXCEPTION: if under 30, do not lead with Wrinkle even if low — mention briefly in insight as prevention.
- EXCEPTION: if two parameters are closely related (Sebum+Pores, Superficial+Brown pigment), group into one observation using the lower score.
- Use the exact numeric score from the Analysis parameter lists for each observation.
- Moisture % is a hydration reading only — never use it as an observation score.

Return ONLY the JSON. No markdown fences, no commentary outside the JSON.`;
}

const KAI_SCORE_LABELS: Array<{ min: number; label: string }> = [
  { min: 85, label: "Radiant Skin" },
  { min: 70, label: "Strong Foundation" },
  { min: 55, label: "Room to Glow" },
  { min: 40, label: "Needs Attention" },
  { min: 0, label: "Time to Act" },
];

const GRADE_BANDS: Array<{ min: number; grade: KaiGrade; band: string }> = [
  { min: 80, grade: "A", band: "green band" },
  { min: 65, grade: "B", band: "blue band" },
  { min: 50, grade: "C", band: "yellow band" },
  { min: 35, grade: "D", band: "orange band" },
  { min: 0, grade: "E", band: "red band" },
];

export function kaiScoreLabel(score: number): string {
  return (KAI_SCORE_LABELS.find((b) => score >= b.min) ?? KAI_SCORE_LABELS[KAI_SCORE_LABELS.length - 1]).label;
}

export function kaiScoreGradeBand(score: number): { grade: KaiGrade; band: string } {
  const found = GRADE_BANDS.find((b) => score >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
  return { grade: found.grade, band: found.band };
}

function colorForScore(score: number): KaiObservationColor {
  if (score < 40) return "red";
  if (score < 60) return "amber";
  return "green";
}

/** Fixed Baumann letter map (position-independent — each letter is unambiguous). */
const BAUMANN_MAP: Record<string, string> = {
  O: "Oily",
  D: "Dry",
  S: "Sensitive",
  R: "Resistant",
  P: "Pigmented",
  N: "Non-pigmented",
  W: "Wrinkle-prone",
  T: "Tight",
};

/**
 * Expand a Baumann skin-type code (e.g. ORNW) into its plain-English descriptors
 * deterministically. The mapping is fixed, so we never rely on the model for this
 * — guarantees all four descriptors always render.
 */
export function expandBaumannCode(code: string): string {
  const letters = code.trim().toUpperCase().replace(/[^A-Z]/g, "").split("");
  const parts = letters.map((l) => BAUMANN_MAP[l]).filter(Boolean);
  return parts.join(" · ");
}

function defaultOpenAiModel(): string {
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}

function model(): string {
  return process.env.SKINFIT_REPORT_OPENAI_MODEL?.trim() || defaultOpenAiModel();
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

export function isReportAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function metricLine(metrics: SdetectMetric[]): string {
  if (!metrics.length) return "(none)";
  return metrics.map((m) => `${m.label}: ${m.score}`).join(", ");
}

/** Serialise the scraped Medixora data into the RAW REPORT DATA block for the prompt. */
function buildRawDataBlock(data: SdetectReportData): string {
  const p = data.patient;
  const lines = [
    `Name: ${p.name}`,
    `Age: ${p.age || "unknown"}`,
    `Gender: ${p.gender}`,
    `Baumann skin type code: ${data.classification}`,
    `Comprehensive score: ${data.comprehensiveScore}`,
    `Moisture level: ${data.moisture}% (hydration reading — not a scored skin parameter)`,
    "",
    `Comprehensive Analysis parameters (label: score): ${metricLine(data.radar)}`,
    `General Analysis parameters: ${metricLine(data.generalAnalysis)}`,
    `In-depth Analysis parameters: ${metricLine(data.inDepthAnalysis)}`,
  ];
  if (data.issueAnalysis.trim()) {
    lines.push("", `Issue analysis text: ${data.issueAnalysis.trim()}`);
  }
  return lines.join("\n");
}

type RawAiContent = {
  skinTypeCode?: unknown;
  skinTypePlain?: unknown;
  skinTypeSummary?: unknown;
  kaiScoreLabel?: unknown;
  kaiScoreContext?: unknown;
  observations?: unknown;
  insight?: unknown;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function clampScore(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normaliseObservations(raw: unknown): KaiObservation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 3)
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const score = clampScore(o.score, 0);
      const title = asString(o.title, "Skin observation").replace(/\s+/g, " ");
      const commentary = asString(o.commentary).replace(/\s+/g, " ");
      const colorRaw = asString(o.color).toLowerCase();
      const color: KaiObservationColor =
        colorRaw === "red" || colorRaw === "amber" || colorRaw === "green"
          ? (colorRaw as KaiObservationColor)
          : colorForScore(score);
      return { title, score, color, commentary };
    })
    .filter((o) => o.title && o.commentary);
}

function allScoredMetrics(data: SdetectReportData): SdetectMetric[] {
  const all = [...data.radar];
  const seen = new Set(all.map((m) => m.label));
  for (const m of [...data.generalAnalysis, ...data.inDepthAnalysis]) {
    if (!seen.has(m.label)) {
      all.push(m);
      seen.add(m.label);
    }
  }
  return all;
}

/** Lowest parameter scores — used to correct AI observations that pick moisture etc. */
function lowestMetricScores(data: SdetectReportData, count = 3): number[] {
  return allScoredMetrics(data)
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((m) => m.score);
}

/** Observation scores must come from scraped parameters, not moisture or comprehensive score. */
function applyTrueObservationScores(
  observations: KaiObservation[],
  data: SdetectReportData
): KaiObservation[] {
  const validScores = new Set(allScoredMetrics(data).map((m) => m.score));
  const rankedLowest = lowestMetricScores(data, 3);
  return observations.slice(0, 3).map((obs, index) => {
    const score = validScores.has(obs.score)
      ? obs.score
      : (rankedLowest[index] ?? obs.score);
    return { ...obs, score, color: colorForScore(score) };
  });
}

/** Lowest-3 parameters as a deterministic fallback when the model returns nothing usable. */
function fallbackObservations(data: SdetectReportData): KaiObservation[] {
  return allScoredMetrics(data)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((m) => ({
      title: m.label,
      score: m.score,
      color: colorForScore(m.score),
      commentary: "",
    }));
}

/**
 * Interpret the raw Medixora data into the SkinFit kAI report content using the
 * senior-dermatologist prompt. Numeric truth (score, radar values) always comes
 * from the scraped data; the model supplies interpretation/prose.
 */
export async function buildKaiReportContent(
  data: SdetectReportData,
  options: { eventLabel?: string } = {}
): Promise<KaiReportContent> {
  const kaiScore = clampScore(data.comprehensiveScore, 0);
  const { grade, band } = kaiScoreGradeBand(kaiScore);

  // Radar always reflects the real scraped comprehensive-analysis parameters,
  // re-drawn in SkinFit colours (per prompt SECTION 4 note).
  const radar = data.radar.length ? data.radar : data.generalAnalysis;
  const radarLabels = radar.map((m) => m.label);
  const radarValues = radar.map((m) => Math.max(0, Math.min(100, m.score)));

  const client = getClient();
  let ai: RawAiContent | null = null;
  if (client) {
    try {
      const completion = await client.chat.completions.create({
        model: model(),
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(options.eventLabel ?? "") },
          { role: "user", content: `RAW MEDIXORA REPORT DATA:\n${buildRawDataBlock(data)}` },
        ],
      });
      const txt = completion.choices[0]?.message?.content;
      if (txt) ai = JSON.parse(txt) as RawAiContent;
    } catch (err) {
      console.error("[skinfit-report-generator] AI interpretation failed", err);
      ai = null;
    }
  }

  const observations = ai ? normaliseObservations(ai.observations) : [];
  const finalObservations = applyTrueObservationScores(
    observations.length >= 3 ? observations : fallbackObservations(data),
    data
  );

  const skinTypeCode = asString(ai?.skinTypeCode, data.classification) || data.classification;
  // Derive the plain expansion from the code (fixed mapping) rather than trusting
  // the model, which occasionally drops a descriptor. Fall back to AI text only
  // if the code has no recognisable Baumann letters.
  const derivedPlain = expandBaumannCode(skinTypeCode);
  const skinTypePlain = derivedPlain || asString(ai?.skinTypePlain);

  return {
    skinTypeCode,
    skinTypePlain,
    skinTypeSummary: asString(ai?.skinTypeSummary),
    kaiScore,
    kaiScoreLabel: asString(ai?.kaiScoreLabel) || kaiScoreLabel(kaiScore),
    kaiScoreGrade: grade,
    kaiScoreBand: band,
    kaiScoreContext: asString(ai?.kaiScoreContext),
    observations: finalObservations,
    radarLabels,
    radarValues,
    insight: asString(ai?.insight),
  };
}
