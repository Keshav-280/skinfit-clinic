/**
 * What the styled (FLO Santé design) report says about one Medixora scan. Scores, titles, colours
 * and skin type come from code. Sentences are written by the AI and published only after a second
 * AI and the code checks pass; otherwise the report is made without them (never a canned line).
 */
import {
  aiReview,
  feedbackBrief,
  runVerified,
  temperatureFor,
  verifiedClient,
  writerModel,
} from "@/src/lib/aiVerified";
import {
  expandBaumannCode,
  kaiScoreGradeBand,
  kaiScoreLabel,
  type KaiObservationColor,
  type KaiReportContent,
} from "@/src/lib/sdetectReport/aiReport";
import { SDETECT_RADAR_LABELS } from "@/src/lib/sdetectReport/radarLabels";
import type { SdetectMetric } from "@/src/lib/sdetectReport/types";
import type { MedixoraReport } from "@/src/lib/medixora/report";

/** Plain words for the machine's measure names. */
export const PLAIN_TITLES: Record<string, string> = {
  "Superficial pigment": "Surface dark spots",
  "Brown pigment": "Brown pigmentation",
  "Mixed spot": "Mixed spots",
  Collagen: "Collagen and firmness",
  Sebum: "Oil balance",
  Pores: "Visible pores",
  Acne: "Acne and breakouts",
  "Deep Pigment": "Deeper pigmentation",
  "Heat Map of Sensitivity": "Skin sensitivity",
  "Red Map of Sensitivity": "Redness",
  Wrinkle: "Fine lines",
};

export const frontScore = (report: MedixoraReport, name: string) =>
  report.scores.find((r) => r.name === name)?.front ?? null;

/** The radar chart: the machine's comprehensive measures, front view. */
export function radarMetrics(report: MedixoraReport): SdetectMetric[] {
  return SDETECT_RADAR_LABELS.flatMap((label) => {
    const score = frontScore(report, label);
    return score == null ? [] : [{ label, score }];
  });
}

/** One strength (highest) then the two lowest. Under 30, fine lines are not raised unless nothing else is. */
export function pickObservations(report: MedixoraReport): SdetectMetric[] {
  const sorted = radarMetrics(report).sort((a, b) => b.score - a.score);
  const [top, ...rest] = sorted;
  if (!top) return [];
  const age = Number(report.customer.age) || 0;
  const low = rest.reverse();
  const preferred = low.filter((m) => !(age > 0 && age < 30 && m.label === "Wrinkle"));
  return [top, ...(preferred.length >= 2 ? preferred : low).slice(0, 2)];
}

export const colorFor = (score: number): KaiObservationColor =>
  score < 40 ? "red" : score < 60 ? "amber" : "green";

export type Prose = { skinTypeSummary: string; commentaries: string[]; insight: string };

const NO_PROSE: Prose = { skinTypeSummary: "", commentaries: [], insight: "" };

const FORBIDDEN =
  /\b(retinol|retinoid|niacinamide|salicylic|glycolic|hyaluronic|vitamin c|acids?|peels?|lasers?|microneedling|botox|fillers?|injections?|antibiotics?|steroids?|melasma|rosacea|eczema|psoriasis|cancer|diagnos\w*|ruby|medixora|baumann)\b/i;

const sentences = (s: string) => s.match(/[^.!?]+[.!?]+/g)?.length ?? 0;

/** Exact rules, checked by code. */
export function proseProblems(p: unknown): string[] {
  const o = (p && typeof p === "object" ? p : {}) as Partial<Prose>;
  const out: string[] = [];
  const check = (label: string, v: unknown, min: number, max: number, chars: number) => {
    if (typeof v !== "string" || !v.trim()) return void out.push(`${label} is missing`);
    const n = sentences(v);
    if (n < min || n > max) out.push(`${label} must be ${min === max ? min : `${min} to ${max}`} complete sentences`);
    if (v.length > chars) out.push(`${label} is longer than ${chars} characters`);
    if (/\d/.test(v)) out.push(`${label} must not contain digits`);
    if (/!|\p{Extended_Pictographic}/u.test(v)) out.push(`${label} must not contain exclamation marks or emojis`);
    const word = FORBIDDEN.exec(v);
    if (word) out.push(`${label} must not say "${word[0]}"`);
  };
  check("skinTypeSummary", o.skinTypeSummary, 1, 1, 170);
  if (!Array.isArray(o.commentaries) || o.commentaries.length !== 3) out.push("write exactly 3 commentaries");
  else o.commentaries.forEach((c, i) => check(`commentary ${i + 1}`, c, 2, 2, 230));
  check("insight", o.insight, 4, 5, 580);
  return out;
}

const WRITER_PROMPT = `You write the words of a one-page skin report a clinic patient in Bangalore will read after a skin analyser scan. Sound like a warm, knowledgeable skin expert talking to this one person: plain, direct, never alarming, never salesy.

Scores are out of 100 and a HIGHER score means better. observations[0] is their strength; observations[1] and observations[2] need the most care.

Return ONLY JSON: {"skinTypeSummary": string, "commentaries": [string, string, string], "insight": string}
- skinTypeSummary: exactly 1 sentence (under 170 characters) on what this skin type feels like day to day.
- commentaries: one per observation, same order, exactly 2 sentences each (under 230 characters). For the strength: what is working and why to protect it. For the others: what it means on the skin, then why it matters for them.
- insight: 4 to 5 sentences (under 580 characters): connect the two care areas, give one simple thing to do this week, and end on the strength.

Never write digits (the scores are printed beside your words). Everyday habits are fine (gentle cleansing, moisturiser, sunscreen, water, sleep). Never name a product, ingredient, treatment, device, medicine, medical condition, doctor or clinic. No promises, no exclamation marks, no emojis.`;

const REVIEW_RULES = `You are the safety checker for a one-page skin report a patient will read. Another AI wrote the CANDIDATE from the DATA. Scores are out of 100 and higher is better. observations[0] is a strength, the other two need care. Check ONLY these rules, and quote words that really appear in the CANDIDATE.
1. MEDICAL. Names a medicine, product, active ingredient, treatment, procedure, device or medical condition. Everyday habits and plain skin words are fine.
2. WRONG WAY ROUND. Calls a care area a strength, or the strength a problem, or says something the DATA does not support about this person.
3. PROMISE OR CERTAIN CAUSE. Promises a result, or states as fact what caused their skin to be this way.
4. TONE (soft). Alarming, shaming, cold or salesy.
5. REPEAT (soft). Two parts say almost the same sentence.
Reply with ONLY JSON: {"issues": [{"rule": 1-5, "quote": "exact words from the CANDIDATE", "why": "one short sentence"}]}. If nothing is wrong reply {"issues": []}.`;

async function writeProse(data: object): Promise<Prose> {
  const client = verifiedClient();
  if (!client) return NO_PROSE;
  const out = await runVerified<Prose>({
    name: "medixora-report",
    maxAttempts: 3,
    generate: async (feedback) => {
      try {
        const res = await client.chat.completions.create(
          {
            model: writerModel(),
            ...temperatureFor(writerModel(), 0.5),
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: WRITER_PROMPT },
              { role: "user", content: `DATA:\n${JSON.stringify(data)}${feedback ? feedbackBrief(feedback) : ""}` },
            ],
          },
          { timeout: 60_000 }
        );
        return JSON.parse(res.choices[0]?.message?.content ?? "") as Prose;
      } catch (e) {
        console.error("medixora report writer failed", e instanceof Error ? e.message : e);
        return null;
      }
    },
    review: (candidate) =>
      aiReview({
        kind: "a one-page skin analyser report",
        data,
        candidate,
        rules: REVIEW_RULES,
        softRules: [4, 5],
      }),
    codeCheck: proseProblems,
  });
  return out ?? NO_PROSE;
}

/** `write` is replaceable so the layout can be checked without calling the AI. */
export async function buildReportContent(
  report: MedixoraReport,
  write: (data: object) => Promise<Prose> = writeProse
): Promise<{ content: KaiReportContent; hasProse: boolean }> {
  const picked = pickObservations(report);
  const score = Math.max(0, Math.min(100, report.overallScore ?? 0));
  const { grade, band } = kaiScoreGradeBand(score);
  const skinTypeCode = report.skinTypeCode;
  const skinTypePlain = expandBaumannCode(skinTypeCode);

  // Deliberately no name or phone: the writer does not need them.
  const prose = await write({
    age: report.customer.age || null,
    gender: report.customer.gender || null,
    skin_type: skinTypePlain || null,
    overall: kaiScoreLabel(score),
    observations: picked.map((m, i) => ({
      area: PLAIN_TITLES[m.label] ?? m.label,
      score_100: m.score,
      role: i === 0 ? "strength" : "needs care",
    })),
  });
  const radar = radarMetrics(report);
  const hasProse = Boolean(prose.insight);

  return {
    hasProse,
    content: {
      skinTypeCode: skinTypePlain ? skinTypeCode : "-",
      skinTypePlain,
      skinTypeSummary: prose.skinTypeSummary,
      kaiScore: score,
      kaiScoreLabel: kaiScoreLabel(score),
      kaiScoreGrade: grade,
      kaiScoreBand: band,
      kaiScoreContext: "",
      observations: picked.map((m, i) => ({
        title: PLAIN_TITLES[m.label] ?? m.label,
        score: m.score,
        color: colorFor(m.score),
        commentary: prose.commentaries[i] ?? "",
      })),
      radarLabels: radar.map((m) => m.label),
      radarValues: radar.map((m) => m.score),
      insight: prose.insight,
    },
  };
}
