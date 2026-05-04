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

function paramsLine(
  params: Array<{ key: RagKaiParamKey; value: number | null; delta: number | null }>
) {
  return params
    .map((p) => {
      const v = p.value == null ? "—" : String(p.value);
      const d = p.delta == null ? "—" : p.delta >= 0 ? `+${p.delta}` : String(p.delta);
      return `${RAG_KAI_PARAM_LABELS[p.key]}=${v} (Δ${d})`;
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
}): Promise<LlmTrackerAnalysis | null> {
  const signalPack = buildNarrativeSignalPack(input.correlations, input.behavior);

  const system = `You are kAI, a dermatology-informed AI beauty counselor.
You must ground claims in the evidence blocks when you cite clinical reasoning.
Output ONLY a valid JSON object matching the specified schema. No preamble.
Tone: warm, specific, non-medical-jargon. Never invent data.
CAUSES MUST BE BALANCED: include BOTH what went well (wins) and what dragged (risks), not just one side — even when the week was mostly good. If a parameter held steady, explain WHY it held. If everything was positive, still call out one realistic risk or watch-out for next week.
EMPATHY PARAGRAPH must acknowledge the mix (wins + drags) in plain language and end with a forward-looking sentence.`;

  const user = `PATIENT CONTEXT
Name: ${input.patient.name}
Skin type: ${input.patient.skinType ?? "unknown"}
Primary concern: ${input.patient.primaryConcern ?? "unknown"}
Sensitivity index: ${input.patient.sensitivityIndex ?? "n/a"}/10
UV sensitivity: ${input.patient.uvSensitivity ?? "n/a"}
Hormonal correlation: ${input.patient.hormonalCorrelation ?? "n/a"}

SCAN #${input.scanIndex} on ${input.scanDate}
kAI score: ${input.kaiScore}
Weekly delta: ${input.weeklyDelta >= 0 ? "+" : ""}${input.weeklyDelta}
Consistency: ${input.consistencyPct}%
Parameters: ${paramsLine(input.params)}

BEHAVIOR SNAPSHOT (past ${input.behavior.windowDays} days)
Full routine days: ${input.behavior.fullRoutineDays}/${input.behavior.windowDays}
AM days: ${input.behavior.amRoutineDays}, PM days: ${input.behavior.pmRoutineDays}
Routine intensity (granular): avg AM checklist ${input.behavior.avgAmRoutineStepPct}%, avg PM checklist ${input.behavior.avgPmRoutineStepPct}% → blended ~${input.behavior.routineWeightedConsistencyPct}%
Avg sleep: ${input.behavior.avgSleepHours}h, Avg water: ${input.behavior.avgWaterGlasses} glasses
Avg stress: ${input.behavior.avgStress}/10, High-stress days: ${input.behavior.highStressDays}
High-UV days: ${input.behavior.highSunDays}, Moderate-UV: ${input.behavior.moderateSunDays}
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
- CAUSES: exactly 4 bullets, each tagged internally: at least 2 "wins" (what helped or what held steady) and at least 1 "drag" or risk (what hurt or what could regress). Use real numbers from the data.
  - Prefix each cause with either "Win:" or "Drag:" or "Watch:" so the UI can tag it.
- EMPATHY: acknowledge mix of wins and drags, plain language, 2-3 sentences, forward-looking.
Return ONLY JSON with this exact shape:
{
  "hookLine": "string (one human sentence naming what happened this week; earned, not generic)",
  "empathyParagraph": "string (2-3 sentences; balanced tone that names wins AND risks)",
  "causes": ["Win: <sentence with numbers>", "Win: <sentence>", "Drag: <sentence>", "Watch: <sentence>"],
  "actions": [
    {"rank": 1, "title": "string", "detail": "string tied to data"},
    {"rank": 2, "title": "string", "detail": "string"},
    {"rank": 3, "title": "string", "detail": "string"}
  ],
  "article": {"title": "string derived from the best evidence chunk", "source": "string citing E# ref or textbook name+page", "why": "string (<= 25 words) explaining relevance to this patient"},
  "video": {"title": "string", "url": "string", "why": "string"},
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
Temporal rule: each row's date D is the day you are advising FOR. Log fields (AM/PM, sleep, sun, mood, water) describe the LAST COMPLETED day before D (behaviorAsOfDate), not D itself — treat them as "what we know through yesterday". Scans/kAI/weakest are also only through that same cutoff. Write the message and goals as guidance FOR calendar day D (today forward), and when you cite sun or routine, phrase it as based on what happened through behaviorAsOfDate (e.g. "after yesterday's UV" / "your last few nights") not as if the patient already logged D.
Do not repeat yourself across days; each day must name something specific from that row's facts.
Return ONLY valid JSON. No preamble.`;

  const user = `PATIENT
${input.patient.name} · Skin: ${input.patient.skinType ?? "unknown"} · Concern: ${input.patient.primaryConcern ?? "unknown"}

WEEK ${input.weekStartDate} → ${input.weekEndDate}

PER-DAY FACTS — each line: target day D, then signals through behaviorAsOfDate (day before D). Do not treat AM/PM/sun/mood as same-calendar-day-as-D.
${input.dailyFacts
  .map(
    (d) =>
      `D=${d.date} (signals through ${d.behaviorAsOfDate ?? "—"}) | AM=${d.amRoutine ? "Y" : "N"} PM=${d.pmRoutine ? "Y" : "N"} sleep=${
        d.sleepHours ?? "—"
      }h stress=${d.stressLevel ?? "—"} water=${d.waterGlasses ?? "—"} sun=${
        d.sunExposure ?? "—"
      } mood=${d.mood ?? "—"} | scans=${d.scansUpToDate} kAI=${
        d.latestKaiScore ?? "—"
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
}): Promise<LlmMonthlyAnalysis | null> {
  const system = `You are kAI. Write a clear monthly progress note grounded in data.
No hype, no generic text. Speak directly to the patient. Return ONLY JSON.
The headline month kAI is kaiMonthAvgFromParams: it is NOT an average of per-scan kAIs. It is computed by averaging each of the 8 parameter scores across all scans in the month, then applying the same weighted kAI formula. Cite this number when summarizing how the month went. Per-scan trajectory is supporting context only.
Explicitly acknowledge poor outcomes when journaling compliance is low (<45%) — tell them to reboot that habit next month — and cite partial checklist completion percentages when blended routine intensity is weak.`;

  const user = `PATIENT
${input.patient.name} · Skin: ${input.patient.skinType ?? "unknown"} · Concern: ${input.patient.primaryConcern ?? "unknown"}

MONTH STARTING ${input.monthStart}
HEADLINE MONTH kAI (mean parameters across ${input.scansAveragedForMonthKai} scan(s)): ${input.kaiMonthAvgFromParams ?? "n/a"}
Per-scan kAI series in this month (${input.scoreTrend.length} pts): ${input.scoreTrend.join(" → ")}

LATEST PARAMETERS
${paramsLine(input.latestParams)}

BEHAVIOR (past ${input.behavior.windowDays} calendar days counted in this month report)
Full AM+PM: ${input.behavior.fullRoutineDays}/${input.behavior.windowDays} | granular blend ~${input.behavior.routineWeightedConsistencyPct}% (avg AM checklist ${input.behavior.avgAmRoutineStepPct}% · avg PM checklist ${input.behavior.avgPmRoutineStepPct}%)
Sleep avg ${input.behavior.avgSleepHours}h | high-UV ${input.behavior.highSunDays}d | high-stress ${input.behavior.highStressDays}d | journal ${input.behavior.journalEntriesCount}/${input.behavior.windowDays} (${input.behavior.journalCompliancePct}%, missed ${input.behavior.journalMissedDays}d)

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
