import OpenAI from "openai";
import {
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";
import type {
  BehaviorSnapshot,
  BehaviorParamCorrelation,
} from "@/src/lib/ragCorrelationStats";
import { buildNarrativeSignalPack } from "@/src/lib/ragCorrelationStats";
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";
import {
  patientDisplayClarity,
  patientClarityToGrade,
  patientUnlockedDisplayScore,
  gradeSublabel,
  PATIENT_DISPLAY_SCORE_CAP,
  PATIENT_DISPLAY_SCORE_FLOOR,
} from "@/src/lib/clarityGrade";

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key });
  return cachedClient;
}

function model() {
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}

function chunkLines(chunks: Array<{ chunk: TextbookChunk; score: number }>) {
  return chunks
    .map(
      (c, i) =>
        `[E${i + 1}] (${c.chunk.source}${
          c.chunk.pageHint ? ` p.${c.chunk.pageHint}` : ""
        }, tags=${c.chunk.tags.join(",")}, score=${c.score.toFixed(2)})\n${c.chunk.text
          .replace(/\s+/g, " ")
          .slice(0, 500)}`
    )
    .join("\n\n");
}

/** Qualitative band word for locked patients (no numbers, no letter grades in prose). */
function lockedQualitativeBand(rawScore: number): string {
  return gradeSublabel(patientClarityToGrade(rawScore)).toLowerCase();
}

function paramsLine(
  params: Array<{ key: RagKaiParamKey; value: number | null; delta: number | null }>,
  scoresUnlocked: boolean
) {
  return params
    .map((p) => {
      const v =
        p.value == null
          ? "—"
          : scoresUnlocked
            ? String(patientUnlockedDisplayScore(p.value))
            : lockedQualitativeBand(p.value);
      const d = p.delta == null ? "—" : p.delta >= 0 ? `+${p.delta}` : String(p.delta);
      const deltaStr = scoresUnlocked ? `Δ${d}` : `trend: ${p.delta == null ? "unknown" : p.delta >= 3 ? "improving" : p.delta <= -3 ? "softer" : "steady"}`;
      return `${RAG_KAI_PARAM_LABELS[p.key]}=${v} (${deltaStr})`;
    })
    .join(" · ");
}

async function callJson<T>(system: string, user: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: model(),
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const txt = completion.choices[0]?.message?.content;
    if (!txt) return null;
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

/** -------- Tracker report analysis (per scan) -------- */

export type LlmTrackerAnalysis = {
  hookLine: string;
  empathyParagraph: string;
  causes: string[];
  actions: Array<{ rank: 1 | 2 | 3; title: string; detail: string }>;
  article: { title: string; source: string; why: string };
  video: { title: string; url: string; why: string };
  insight: { title: string; body: string };
};

export async function analyzeTrackerReport(input: {
  scanContextKind?: "onboarding_first_scan" | "same_week_followup" | "new_week_followup";
  scanContextNote?: string;
  patient: {
    name: string;
    skinType: string | null;
    primaryConcern: string | null;
    sensitivityIndex: number | null;
    uvSensitivity: string | null;
    hormonalCorrelation: string | null;
  };
  scanDate: string;
  scanIndex: number;
  kaiScore: number;
  weeklyDelta: number;
  consistencyPct: number;
  params: Array<{
    key: RagKaiParamKey;
    value: number | null;
    delta: number | null;
  }>;
  behavior: BehaviorSnapshot;
  correlations: BehaviorParamCorrelation[];
  evidence: Array<{ chunk: TextbookChunk; score: number }>;
  visitNotesSummary: string | null;
  recentChatSummary: string | null;
  scoresUnlocked: boolean;
}): Promise<LlmTrackerAnalysis | null> {
  const signalPack = buildNarrativeSignalPack(input.correlations, input.behavior);

  const system = `You are kAI, a dermatology-informed AI beauty counselor.
You must ground claims in the evidence blocks when you cite clinical reasoning.
Output ONLY a valid JSON object matching the specified schema. No preamble.
Tone: warm, human, like a caring clinic coordinator. Short sentences. No em dashes or hyphen punctuation.
Never invent data. Never shame the patient (avoid "no active efforts", "lack of routine", "failure to").
IMPORTANT SCALE DIRECTION: All skin parameters (Active Acne, Wrinkles, Pigmentation, etc.) and the overall kAI score are clarity/health scores where higher is BETTER (clearer, healthier skin) and lower is WORSE. E.g., if Active Acne went from 32 down to 25, acne got worse, NOT better. Always describe trends with this direction.
STRICT DATA RULES:
- Every number you write MUST appear verbatim in the data below. Never invent, estimate, round up, or extrapolate a score.
- Patient scores are ALWAYS between ${PATIENT_DISPLAY_SCORE_FLOOR} and ${PATIENT_DISPLAY_SCORE_CAP}. Never write a skin score above ${PATIENT_DISPLAY_SCORE_CAP}, never write "100", never write "X/100", and never describe a score as perfect or maxed out.
- NEVER mention UV, sun exposure, sunscreen days, or photoprotection habits as something we measured. This app does NOT collect sun-exposure data. Do not reference it at all.
${
  !input.scoresUnlocked
    ? `- The patient's exact scores are LOCKED. You MUST NOT output any score numbers or deltas (no "72", no "+5"), and you MUST NOT use letter grades (A/B/C/D/E) either. Describe every parameter only with qualitative words already given in the data (e.g. "good", "moderate", "improving", "held steady").`
    : `- The patient's exact scores are UNLOCKED. Use ONLY the exact score numbers and deltas provided below. Do NOT use letter grades (A/B/C/D/E) anywhere — the patient sees numbers, not grades.`
}
CAUSES MUST BE BALANCED: include BOTH what went well (wins) and what dragged (risks), not just one side. If a parameter held steady, explain why in plain words. If everything was positive, one gentle watch-out for next week is enough.
EMPATHY PARAGRAPH: at most 2 short sentences. Encouraging, specific to the data, forward looking. No clinical lecture.`;

  const user = `PATIENT CONTEXT
Name: ${input.patient.name}
Skin type: ${input.patient.skinType ?? "unknown"}
Primary concern: ${input.patient.primaryConcern ?? "unknown"}
Sensitivity index: ${input.patient.sensitivityIndex ?? "n/a"}/10
Hormonal correlation: ${input.patient.hormonalCorrelation ?? "n/a"}

SCAN CONTEXT
${input.scanContextNote ?? "Standard weekly tracker report."}

SCAN #${input.scanIndex} on ${input.scanDate}
kAI score: ${input.scoresUnlocked ? patientUnlockedDisplayScore(input.kaiScore) : lockedQualitativeBand(input.kaiScore)}
Weekly delta: ${input.scoresUnlocked ? `${input.weeklyDelta >= 0 ? "+" : ""}${input.weeklyDelta}` : input.weeklyDelta >= 3 ? "improving" : input.weeklyDelta <= -3 ? "softer than last scan" : "steady"}
Consistency: ${input.consistencyPct}%
Parameters: ${paramsLine(input.params, input.scoresUnlocked)}

BEHAVIOR SNAPSHOT (past ${input.behavior.windowDays} days)
Full routine days: ${input.behavior.fullRoutineDays}/${input.behavior.windowDays}
AM days: ${input.behavior.amRoutineDays}, PM days: ${input.behavior.pmRoutineDays}
Routine intensity (granular): avg AM checklist ${input.behavior.avgAmRoutineStepPct}%, avg PM checklist ${input.behavior.avgPmRoutineStepPct}% → blended ~${input.behavior.routineWeightedConsistencyPct}%
Avg sleep: ${input.behavior.avgSleepHours}h, Avg water: ${input.behavior.avgWaterGlasses} glasses
Avg stress: ${input.behavior.avgStress}/10, High-stress days: ${input.behavior.highStressDays}
Journal entries: ${input.behavior.journalEntriesCount}/${input.behavior.windowDays} (${input.behavior.journalCompliancePct}%) • missed journaling on ${input.behavior.journalMissedDays} days

SIGNAL PACK
IMPROVERS (Δ ≥ +3):
${signalPack.improvers.length
  ? signalPack.improvers
      .map(
        (c) =>
          `• ${c.label} (Δ${c.delta! >= 0 ? "+" : ""}${c.delta}): ${c.reasons.join("; ") || "no rule-based reason yet"}`
      )
      .join("\n")
  : "  (none)"}

DRAGGERS (Δ ≤ -3):
${signalPack.draggers.length
  ? signalPack.draggers
      .map(
        (c) =>
          `• ${c.label} (Δ${c.delta}): ${c.reasons.join("; ") || "no rule-based reason yet"}`
      )
      .join("\n")
  : "  (none)"}

STABLE (|Δ| < 3): ${signalPack.stables.map((s) => `${s.label}(Δ${s.delta ?? "—"})`).join(", ") || "none"}

AGGREGATED WINS SIGNALS:
${signalPack.topWins.map((w) => `  + ${w}`).join("\n") || "  (none)"}

AGGREGATED DRAG SIGNALS:
${signalPack.topDrags.map((w) => `  - ${w}`).join("\n") || "  (none)"}

${input.visitNotesSummary ? `VISIT NOTES\n${input.visitNotesSummary}\n` : ""}${input.recentChatSummary ? `RECENT CHAT\n${input.recentChatSummary}\n` : ""}

TEXTBOOK EVIDENCE (BM25 top-k)
${chunkLines(input.evidence)}

TASK
Produce the weekly tracker report for this scan. Be concrete and tied to data above.
- CAUSES: exactly 4 bullets, each tagged internally: at least 2 "wins" (what helped or what held steady) and at least 1 "drag" or risk (what hurt or what could regress). ${input.scoresUnlocked ? "Only cite numbers that appear verbatim in the data above." : "Use qualitative words only, never numbers or letter grades."}
  - Prefix each cause with either "Win:" or "Drag:" or "Watch:" so the UI can tag it.
  - Never mention UV or sun exposure.
- EMPATHY: max 2 short warm sentences. Plain language. Forward looking. No dashes as punctuation.
- ACTION DETAILS: each action.detail must be EXACTLY 3 lines in this structure:
  Why: <1 sentence tied to this patient's numbers/signals>
  Do: <1 practical instruction with timing/frequency>
  Target: <1 measurable checkpoint by next scan/week>
Return ONLY JSON with this exact shape:
{
  "hookLine": "string (one human sentence naming what happened this week; earned, not generic)",
  "empathyParagraph": "string (max 2 short sentences; warm, human, encouraging)",
  "causes": ["Win: <sentence>", "Win: <sentence>", "Drag: <sentence>", "Watch: <sentence>"],
  "actions": [
    {"rank": 1, "title": "string", "detail": "Why: ...\nDo: ...\nTarget: ..."},
    {"rank": 2, "title": "string", "detail": "Why: ...\nDo: ...\nTarget: ..."},
    {"rank": 3, "title": "string", "detail": "Why: ...\nDo: ...\nTarget: ..."}
  ],
  "article": {"title": "string derived from the best evidence chunk", "source": "string citing E# ref or textbook name+page", "why": "string (<= 25 words) explaining relevance to this patient"},
  "video": {"title": "string", "url": "string (https YouTube or educational link)", "why": "string"},
  "insight": {"title": "string", "body": "string (<= 40 words), grounded in evidence or correlation"}
}`;

  return await callJson<LlmTrackerAnalysis>(system, user);
}

/** -------- Daily focus batch (7 days at a time) -------- */

export type LlmDailyFocusItem = {
  date: string;
  message: string;
  sourceParam: string | null;
  goals: string[];
};

export async function analyzeDailyFocusBatch(input: {
  patient: {
    name: string;
    skinType: string | null;
    primaryConcern: string | null;
  };
  weekStartDate: string;
  weekEndDate: string;
  dailyFacts: Array<{
    date: string;
    /** Last completed day reflected in log fields (typically date − 1 day). */
    behaviorAsOfDate: string | null;
    amRoutine: boolean;
    pmRoutine: boolean;
    sleepHours: number | null;
    stressLevel: number | null;
    waterGlasses: number | null;
    sunExposure: string | null;
    mood: string | null;
    scansUpToDate: number;
    latestKaiScore: number | null;
    weakestParamLabel: string | null;
    routineConsistencyPct: number;
  }>;
  evidence: Array<{ chunk: TextbookChunk; score: number }>;
}): Promise<LlmDailyFocusItem[] | null> {
  if (input.dailyFacts.length === 0) return [];
  const system = `You are kAI, a dermatology-aware AI beauty counselor.
Produce ONE sharp, personalized nudge per day — like Amorepacific AI Beauty Counselor.
Temporal rule: each row's date D is the day you are advising FOR. Log fields (AM/PM, sleep, mood, water) describe the LAST COMPLETED day before D (behaviorAsOfDate), not D itself — treat them as "what we know through yesterday". Scans/kAI/weakest are also only through that same cutoff. Write the message and goals as guidance FOR calendar day D (today forward), and when you cite routine or sleep, phrase it as based on what happened through behaviorAsOfDate (e.g. "your last few nights") not as if the patient already logged D.
Do not repeat yourself across days; each day must name something specific from that row's facts.
NEVER mention UV or sun exposure — this app does not collect sun-exposure data.
IMPORTANT SCALE DIRECTION: All parameter scores (e.g. Active Acne, etc.) are clarity/health scores where higher is better/clearer skin and lower is worse. Only cite numbers that appear in the data.
Return ONLY valid JSON. No preamble.`;

  const user = `PATIENT
${input.patient.name} · Skin: ${input.patient.skinType ?? "unknown"} · Concern: ${input.patient.primaryConcern ?? "unknown"}

WEEK ${input.weekStartDate} → ${input.weekEndDate}

PER-DAY FACTS — each line: target day D, then signals through behaviorAsOfDate (day before D). Do not treat AM/PM/mood as same-calendar-day-as-D.
${input.dailyFacts
  .map(
    (d) =>
      `D=${d.date} (signals through ${d.behaviorAsOfDate ?? "—"}) | AM=${d.amRoutine ? "Y" : "N"} PM=${d.pmRoutine ? "Y" : "N"} sleep=${
        d.sleepHours ?? "—"
      }h stress=${d.stressLevel ?? "—"} water=${d.waterGlasses ?? "—"} mood=${d.mood ?? "—"} | scans=${d.scansUpToDate} kAI=${
        d.latestKaiScore == null ? "—" : patientUnlockedDisplayScore(d.latestKaiScore)
      } weakest=${d.weakestParamLabel ?? "—"} consistency7d=${d.routineConsistencyPct}%`
  )
  .join("\n")}

TEXTBOOK EVIDENCE (use sparingly, only when justified)
${chunkLines(input.evidence).slice(0, 1800)}

TASK
For each date D above, produce ONE focus message and 3 ranked goals for that calendar day.
- Ground the message in signals through behaviorAsOfDate; speak about "yesterday / recent days" when using those fields.
- The 3 goals must be concrete, doable on day D, and different across days.
- Do not repeat the same message across dates.

Return ONLY JSON:
{
  "items": [
    {"date": "YYYY-MM-DD", "message": "string", "sourceParam": "string or null", "goals": ["g1","g2","g3"]},
    ...
  ]
}`;

  const parsed = await callJson<{ items: LlmDailyFocusItem[] }>(system, user);
  if (!parsed || !Array.isArray(parsed.items)) return null;
  return parsed.items;
}

/** -------- Monthly synthesis -------- */

export type LlmMonthlyAnalysis = {
  summaryTitle: string;
  summaryBody: string;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
};

export async function analyzeMonthly(input: {
  patient: {
    name: string;
    skinType: string | null;
    primaryConcern: string | null;
  };
  monthStart: string;
  scoreTrend: number[];
  /** Primary headline month score: weighted kAI from mean of each parameter across scans in month. */
  kaiMonthAvgFromParams: number | null;
  scansAveragedForMonthKai: number;
  latestParams: Array<{
    key: RagKaiParamKey;
    value: number | null;
    delta: number | null;
  }>;
  behavior: BehaviorSnapshot;
  evidence: Array<{ chunk: TextbookChunk; score: number }>;
  scoresUnlocked: boolean;
}): Promise<LlmMonthlyAnalysis | null> {
  const system = `You are kAI. Write a clear monthly progress note grounded in data.
No hype, no generic text. Speak directly to the patient. Return ONLY JSON.
The headline month kAI is kaiMonthAvgFromParams: it is NOT an average of per-scan kAIs. It is computed by averaging each of the 6 parameter scores across all scans in the month, then applying the same weighted kAI formula. Per-scan trajectory is supporting context only.
IMPORTANT SCALE DIRECTION: All skin parameters (Active Acne, Wrinkles, Pigmentation, etc.) and the overall kAI score are clarity/health scores where higher is BETTER (clearer, healthier skin) and lower is WORSE. E.g., if Active Acne went from 32 down to 25, acne got worse, NOT better. Always describe trends with this direction.
STRICT DATA RULES:
- Every number you write MUST appear verbatim in the data provided. Never invent, estimate, or extrapolate a score.
- Patient scores are ALWAYS between ${PATIENT_DISPLAY_SCORE_FLOOR} and ${PATIENT_DISPLAY_SCORE_CAP}. Never write a skin score above ${PATIENT_DISPLAY_SCORE_CAP}, never write "100" or "X/100", and never describe a score as perfect or maxed out.
- NEVER mention UV, sun exposure, sunscreen days, or photoprotection habits as something we measured — this app does not collect sun-exposure data.
${
  !input.scoresUnlocked
    ? `- The patient's exact scores are LOCKED. You MUST NOT output any score numbers or deltas, and you MUST NOT use letter grades (A/B/C/D/E) either. Describe parameters only with qualitative words (e.g. "good", "moderate", "improving", "held steady").`
    : `- The patient's exact scores are UNLOCKED. Use ONLY the exact score numbers provided. Do NOT use letter grades (A/B/C/D/E) anywhere — the patient sees numbers, not grades.`
}
Explicitly acknowledge poor outcomes when journaling compliance is low (<45%) — tell them to reboot that habit next month — and cite partial checklist completion percentages when blended routine intensity is weak.`;

  const user = `PATIENT
${input.patient.name} · Skin: ${input.patient.skinType ?? "unknown"} · Concern: ${input.patient.primaryConcern ?? "unknown"}

MONTH STARTING ${input.monthStart}
HEADLINE MONTH kAI (mean parameters across ${input.scansAveragedForMonthKai} scan(s)): ${input.kaiMonthAvgFromParams == null ? "n/a" : input.scoresUnlocked ? patientDisplayClarity(input.kaiMonthAvgFromParams) : lockedQualitativeBand(input.kaiMonthAvgFromParams)}
Per-scan kAI series in this month (${input.scoreTrend.length} pts): ${input.scoreTrend.map((s) => input.scoresUnlocked ? String(patientDisplayClarity(s)) : lockedQualitativeBand(s)).join(" → ")}

LATEST PARAMETERS
${paramsLine(input.latestParams, input.scoresUnlocked)}

BEHAVIOR (past ${input.behavior.windowDays} calendar days counted in this month report)
Full AM+PM: ${input.behavior.fullRoutineDays}/${input.behavior.windowDays} | granular blend ~${input.behavior.routineWeightedConsistencyPct}% (avg AM checklist ${input.behavior.avgAmRoutineStepPct}% · avg PM checklist ${input.behavior.avgPmRoutineStepPct}%)
Sleep avg ${input.behavior.avgSleepHours}h | high-stress ${input.behavior.highStressDays}d | journal ${input.behavior.journalEntriesCount}/${input.behavior.windowDays} (${input.behavior.journalCompliancePct}%, missed ${input.behavior.journalMissedDays}d)

EVIDENCE
${chunkLines(input.evidence).slice(0, 2000)}

Return ONLY JSON:
{
  "summaryTitle": "string (<= 8 words, specific to this month)",
  "summaryBody": "string (3-4 sentences, plain language, tied to data)",
  "highlights": ["3 concrete wins tied to numbers"],
  "risks": ["2 specific risks/regressions to watch"],
  "nextMonthFocus": ["3 specific focus areas for next month"]
}`;

  return await callJson<LlmMonthlyAnalysis>(system, user);
}

export function isLlmEnabled() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generatePersonalisedAction(input: {
  scanCount: number;
  primaryConcern: string | null;
  weakestArea: string | null;
  weakestScore: number | null;
  weeklyDelta: number | null;
  existingActions: string[];
}): Promise<string | null> {
  const system = `You are a dermatology AI assistant for a skin-health app called SkinFit.
Generate ONE short, specific, actionable priority tip (max 30 words) for the patient.
It must NOT repeat any of the existing actions provided.
Be warm but direct. No fluff.
Return JSON: { "action": "..." }`;

  const user = `Patient context:
- Total scans completed: ${input.scanCount}
- Primary concern: ${input.primaryConcern ?? "not set"}
- Current weakest parameter: ${input.weakestArea ?? "unknown"} (score: ${input.weakestScore == null ? "N/A" : patientDisplayClarity(input.weakestScore)}/100)
- Weekly change in weakest area: ${input.weeklyDelta != null ? (input.weeklyDelta >= 0 ? `+${input.weeklyDelta}` : String(input.weeklyDelta)) : "N/A"}

Existing actions (do NOT repeat these):
${input.existingActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;

  const result = await callJson<{ action: string }>(system, user);
  return result?.action?.trim() || null;
}
