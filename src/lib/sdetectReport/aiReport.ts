import OpenAI from "openai";
import { SDETECT_RADAR_LABELS } from "./radarLabels";
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
  "kaiScoreContext": "1 sentence only. Put their comprehensive score in perspective without being alarming or falsely reassuring. Reference their age where relevant.",
  "observations": [
    {
      "title": "Max 4 words, plain English. Never use a clinical Medixora parameter name directly (e.g. Porphyrin -> Clogged pores and bacteria; Heat Map of Sensitivity -> Skin sensitivity and redness).",
      "score": 0,
      "color": "red if below 40 / amber if 40-59 / green if 60+",
      "commentary": "Exactly 2 complete sentences — every sentence must end with a full stop; never truncate or leave a sentence unfinished. For observation 1 (highest score): celebrate the strength — what is working well and why it matters to protect. For observations 2–3 (lowest scores): sentence 1 explains the mechanism; sentence 2 why it matters for their age and skin type, with Indian context where data supports it. No products or treatments."
    }
  ],
  "insight": "MANDATORY: write exactly 5 complete sentences (minimum 4, never 3 or fewer), 500-580 characters total — this is the user's personalised guidance section. Every sentence must end with a full stop. Structure: (1-2) connect the 2 concern observations (positions 2–3) into one root-cause story; (3) one concrete day-to-day focus for this week; (4) age-intelligent guidance; (5) reinforce the strength from observation 1 and what it means. Use Indian context where data supports (PIH, humidity, UV, diet). No clinic, treatment, or product names."
}

SECTION 3 — TOP 3 OBSERVATIONS rules:
- ONLY use parameters from the Comprehensive Analysis radar chart (the green spider chart axes) for all 3 observations. Never use General Analysis or In-depth Analysis parameters or scores.
- Return exactly 3 observations in this fixed order:
  1) FIRST — the single highest-scoring radar-chart parameter. Lead with a genuine positive (green tone). Celebrate what is working; frame as a strength to protect and build on.
  2) SECOND and THIRD — the two lowest-scoring radar-chart parameters. Primary concerns (red/amber tone). Explain mechanism and why each matters.
- EXCEPTION: if under 30, do not use Wrinkle as a concern observation (positions 2–3) unless it is genuinely among the 2 lowest on the radar chart — mention wrinkles briefly in insight as prevention instead.
- EXCEPTION: if two low radar parameters are closely related (Sebum+Pores, Superficial+Brown pigment), group into one observation using the lower score and pick the next-lowest radar parameter for the third slot.
- Use the exact numeric score from the Comprehensive Analysis radar chart for each observation.
- Moisture % is a hydration reading only — never use it as an observation score.
- Return exactly 3 observations. Each commentary must be exactly 2 complete sentences (not 1, not 3).

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
    `Comprehensive Analysis / radar chart parameters ONLY (use these for observations): ${metricLine(data.radar)}`,
    `General Analysis parameters (context only — do NOT use for observation scores): ${metricLine(data.generalAnalysis)}`,
    `In-depth Analysis parameters (context only — do NOT use for observation scores): ${metricLine(data.inDepthAnalysis)}`,
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

const INSIGHT_MAX_CHARS = 580;
const INSIGHT_MIN_SENTENCES = 4;

function clampInsightLength(text: string, max = INSIGHT_MAX_CHARS): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length <= max) return cleaned;

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned];
  let packed = "";
  for (const sentence of sentences) {
    const candidate = (packed ? `${packed} ${sentence}` : sentence).replace(/\s+/g, " ").trim();
    if (candidate.length <= max) packed = candidate;
    else break;
  }
  if (packed && countSentences(packed) >= INSIGHT_MIN_SENTENCES) return packed;

  // Prefer keeping at least 4 full sentences even if slightly over max
  const minPack = sentences.slice(0, INSIGHT_MIN_SENTENCES).join(" ").replace(/\s+/g, " ").trim();
  if (minPack && countSentences(minPack) >= INSIGHT_MIN_SENTENCES) return minPack;

  if (packed) return packed;

  const slice = cleaned.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  return (lastStop > 80 ? slice.slice(0, lastStop + 1) : `${slice.trimEnd()}…`).trim();
}

function countSentences(text: string): number {
  return (text.match(/[^.!?]+[.!?]+/g) ?? []).length;
}

/** Pad short AI commentary to two complete sentences for consistent card layout. */
function ensureTwoSentences(commentary: string, title: string, score: number): string {
  const cleaned = commentary.replace(/\s+/g, " ").trim();
  if (!cleaned) return commentary;
  if (countSentences(cleaned) >= 2) return cleaned;

  const topic = title.toLowerCase();
  if (countSentences(cleaned) === 1) {
    return `${cleaned} At a score of ${score}, this matters more for long-term tone and texture than a single good or bad week — notice when ${topic} feels worse after heat, stress, or skipped care.`;
  }
  return cleaned;
}

/** Comprehensive Analysis radar chart metrics only — observations must match this chart. */
function radarChartMetrics(data: SdetectReportData): SdetectMetric[] {
  if (!data.radar.length) return [];
  const byLabel = new Map(data.radar.map((m) => [m.label, m]));
  const ordered: SdetectMetric[] = [];
  for (const label of SDETECT_RADAR_LABELS) {
    const metric = byLabel.get(label);
    if (metric) ordered.push(metric);
  }
  for (const metric of data.radar) {
    if (!ordered.some((m) => m.label === metric.label)) ordered.push(metric);
  }
  return ordered;
}

function highestScoredMetric(data: SdetectReportData): SdetectMetric | null {
  const metrics = radarChartMetrics(data);
  if (!metrics.length) return null;
  return metrics.sort((a, b) => b.score - a.score)[0];
}

function lowestConcernMetrics(data: SdetectReportData, count = 2): SdetectMetric[] {
  const age = data.patient.age;
  const top = highestScoredMetric(data);
  const sorted = radarChartMetrics(data).sort((a, b) => a.score - b.score);
  const concerns: SdetectMetric[] = [];
  for (const metric of sorted) {
    if (top && metric.label === top.label) continue;
    if (age && age < 30 && /wrinkle/i.test(metric.label)) continue;
    concerns.push(metric);
    if (concerns.length >= count) break;
  }
  return concerns;
}

/** Observation order: 1 strength (highest) + 2 concerns (lowest). */
function observationMetrics(data: SdetectReportData): SdetectMetric[] {
  const top = highestScoredMetric(data);
  const concerns = lowestConcernMetrics(data, 2);
  if (!top) return concerns.slice(0, 3);
  const merged = [top, ...concerns.filter((m) => m.label !== top.label)];
  return merged.slice(0, 3);
}

function strongestMetric(data: SdetectReportData): SdetectMetric | null {
  return highestScoredMetric(data);
}

/** Pad short AI insight to 4–5 guiding sentences — observations card already has detail. */
function ensureInsightGuidance(
  insight: string,
  observations: KaiObservation[],
  data: SdetectReportData
): string {
  let text = insight.replace(/\s+/g, " ").trim();
  const age = data.patient.age;
  const strong = strongestMetric(data);
  const concernTitles = observations
    .slice(1, 3)
    .map((o) => o.title.toLowerCase())
    .filter(Boolean);

  if (!text) {
    const focus = concernTitles.length ? concernTitles.join(" and ") : "your priority concerns";
    text =
      `Your scan shows ${focus} linked together — this pattern is common and very manageable with steady focus. ` +
      `Protect your barrier daily and keep hydration consistent so your skin can recover between stressors. ` +
      `Prioritise sun protection every morning — Bangalore UV is year-round and drives most pigmentation flare-ups. ` +
      `This week, keep your routine simple: cleanse gently, moisturise while skin is damp, and do not skip SPF.`;
    if (age) {
      text += ` At ${age}, the habits you build now matter more than quick fixes for long-term tone and texture.`;
    } else {
      text += ` Small, consistent daily habits will move these scores faster than occasional intensive care.`;
    }
    if (strong) {
      text += ` Your ${strong.label} at ${strong.score} is already a strength — use that as your foundation.`;
    }
    return text;
  }

  const labelHint = strong?.label.toLowerCase().slice(0, 6) ?? "";
  const pads: Array<() => string | null> = [
    () =>
      strong && labelHint && !text.toLowerCase().includes(labelHint)
        ? `Your ${strong.label} at ${strong.score} is a genuine asset — build on that strength while you address the priority areas above.`
        : null,
    () =>
      !/sun|spf|uv|morning protect/i.test(text)
        ? `Make broad-spectrum sun protection non-negotiable every morning — Bangalore UV accelerates pigmentation and collagen loss.`
        : null,
    () =>
      !/this week|daily|habit|consistent|focus on|priorit/i.test(text)
        ? `This week, prioritise barrier support and steady hydration — that alone reduces sensitivity and helps everything else work better.`
        : null,
    () =>
      age && !/steady|habit|consistent/i.test(text)
        ? `At ${age}, steady daily care will move these scores faster than occasional intensive treatments.`
        : null,
    () =>
      "Consistent morning SPF and gentle hydration give your skin the best chance to recover between stressors."
  ];

  for (const next of pads) {
    if (countSentences(text) >= 5) break;
    const extra = next();
    if (!extra) continue;
    text = `${text} ${extra}`.replace(/\s+/g, " ").trim();
  }

  while (countSentences(text) < INSIGHT_MIN_SENTENCES) {
    text +=
      " Focus on consistency this week — gentle cleansing, daily hydration, and morning sun protection support everything else.";
  }

  return text;
}

function normaliseObservations(raw: unknown): KaiObservation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 3)
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const score = clampScore(o.score, 0);
      const title = asString(o.title, "Skin observation").replace(/\s+/g, " ");
      const commentary = ensureTwoSentences(
        asString(o.commentary).replace(/\s+/g, " "),
        title,
        score
      );
      const colorRaw = asString(o.color).toLowerCase();
      const color: KaiObservationColor =
        colorRaw === "red" || colorRaw === "amber" || colorRaw === "green"
          ? (colorRaw as KaiObservationColor)
          : colorForScore(score);
      return { title, score, color, commentary };
    })
    .filter((o) => o.title);
}

/** Match AI observations to strength + 2 concerns order using scraped scores. */
function alignObservationsOrder(
  observations: KaiObservation[],
  data: SdetectReportData
): KaiObservation[] {
  const expected = observationMetrics(data);
  if (expected.length < 3 || observations.length < 3) return observations;

  const used = new Set<number>();
  const aligned: KaiObservation[] = [];

  for (const metric of expected) {
    let bestIdx = -1;
    let bestDist = Infinity;
    observations.forEach((obs, index) => {
      if (used.has(index)) return;
      const dist = Math.abs(obs.score - metric.score);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = index;
      }
    });
    if (bestIdx >= 0) {
      used.add(bestIdx);
      aligned.push(observations[bestIdx]);
    }
  }

  observations.forEach((obs, index) => {
    if (!used.has(index) && aligned.length < 3) aligned.push(obs);
  });

  return aligned.slice(0, 3);
}

/** Pin each observation slot to radar-chart metrics: highest, then 2 lowest concerns. */
function applyTrueObservationScores(
  observations: KaiObservation[],
  data: SdetectReportData
): KaiObservation[] {
  const targets = observationMetrics(data);
  return observations.slice(0, 3).map((obs, index) => {
    const metric = targets[index];
    const score = metric?.score ?? obs.score;
    const commentary = ensureTwoSentences(obs.commentary, obs.title, score);
    return { ...obs, score, color: colorForScore(score), commentary };
  });
}

/** Strength + 2 concerns as a deterministic fallback when the model returns nothing usable. */
function fallbackObservations(data: SdetectReportData): KaiObservation[] {
  return observationMetrics(data).map((m, index) => ({
    title: m.label,
    score: m.score,
    color: colorForScore(m.score),
    commentary:
      index === 0
        ? `Your ${m.label} scored ${m.score}% — one of your strongest areas on this scan. This is a solid foundation your skin is already doing well, and protecting it matters while you work on other priorities.`
        : `Your ${m.label} scored ${m.score}% on this scan, placing it among your lowest-scoring parameters. At this level, the skin is working harder than ideal to stay balanced in this area.`,
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
  const picked =
    observations.length >= 3 ? observations : fallbackObservations(data);
  const finalObservations = applyTrueObservationScores(
    alignObservationsOrder(picked, data),
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
    kaiScoreLabel: kaiScoreLabel(kaiScore),
    kaiScoreGrade: grade,
    kaiScoreBand: band,
    kaiScoreContext: asString(ai?.kaiScoreContext),
    observations: finalObservations,
    radarLabels,
    radarValues,
    insight: clampInsightLength(
      ensureInsightGuidance(asString(ai?.insight), finalObservations, data)
    ),
  };
}
