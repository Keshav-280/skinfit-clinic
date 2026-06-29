import { patientClarityToGrade } from "@/src/lib/clarityGrade";
import { RAG_KAI_PARAM_LABELS } from "@/src/lib/ragEightParams";
import { buildNarrativeSignalPack } from "@/src/lib/ragCorrelationStats";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";
import { isLlmEnabled } from "@/src/lib/ragLlmAnalysis";
import { productionTextbookRetrieve } from "@/src/lib/ragRetrieve";
import OpenAI from "openai";
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";
import {
  gatherProfileInsightContext,
  profileContextForLlm,
  profileCorrelations,
  buildProfileRetrievalQuery,
  type ProfileInsightContext,
  type ProfileObservationItem,
  type ProfileObservationSource,
} from "@/src/lib/profileInsightContext";
import type { ProfileKeyObservationsPayload } from "@/src/lib/profileKeyObservations";
import { softenPatientText } from "@/src/lib/weeklyInsightFormat";

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
        }, tags=${c.chunk.tags.join(",")})\n${c.chunk.text.replace(/\s+/g, " ").slice(0, 500)}`
    )
    .join("\n\n");
}

async function callJsonOnce<T>(
  client: OpenAI,
  system: string,
  user: string
): Promise<T | null> {
  const completion = await client.chat.completions.create({
    model: model(),
    temperature: 0.45,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const txt = completion.choices[0]?.message?.content;
  if (!txt) return null;
  return JSON.parse(txt) as T;
}

/**
 * One retry on transient failures. A single OpenAI hiccup previously blanked the
 * profile insights for 10 minutes; retrying once recovers most transient errors.
 */
async function callJson<T>(system: string, user: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await callJsonOnce<T>(client, system, user);
    } catch (e) {
      if (attempt === 1) {
        console.error("[profileRagInsights] LLM call failed (after retry):", e);
        return null;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return null;
}

type ProfileEvidence = Awaited<ReturnType<typeof productionTextbookRetrieve>>;

const VALID_SOURCES: ProfileObservationSource[] = [
  "baseline_scan",
  "daily_logs",
  "scan_trend",
  "weekly_report",
];

function normalizeSource(raw: string): ProfileObservationSource {
  const s = raw.trim().toLowerCase();
  if (VALID_SOURCES.includes(s as ProfileObservationSource)) {
    return s as ProfileObservationSource;
  }
  return "baseline_scan";
}

type LlmObservationsOut = {
  observations?: Array<{
    text?: string;
    source?: string;
    dateLabel?: string;
  }>;
};

type LlmPriorityOut = {
  know?: string[];
  actions?: Array<{ title?: string; detail?: string }>;
};

export async function retrieveForProfile(ctx: ProfileInsightContext) {
  const weak = ctx.latestScan?.params
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  return productionTextbookRetrieve({
    query: buildProfileRetrievalQuery(ctx),
    boostTerms: [
      ctx.identity.primaryConcern ?? "",
      weak ? RAG_KAI_PARAM_LABELS[weak.key] : "",
    ],
    topK: 8,
  });
}

export async function generateProfileKeyObservationsRag(
  ctx: ProfileInsightContext,
  sharedEvidence?: ProfileEvidence,
  scoresUnlocked = false
): Promise<ProfileObservationItem[]> {
  const correlations = profileCorrelations(ctx);
  const signalPack = buildNarrativeSignalPack(correlations, ctx.behavior);
  const evidence = sharedEvidence ?? (await retrieveForProfile(ctx));

  const system = `You are kAI, a dermatology-informed skin health counselor for SkinFit.
Ground clinical claims in TEXTBOOK EVIDENCE blocks when you explain mechanisms.
Use ONLY the patient data in the user message — never invent scan scores, dates, or log days.
Output ONLY valid JSON. No markdown.

IMPORTANT SCALE DIRECTION: All skin parameters (Active Acne, Wrinkles, Pigmentation, etc.) are clarity/health scores from 0 to 100, where 100 is the best (clearest/healthiest skin, e.g. zero active acne) and 0 is the worst (most severe acne). Thus, a lower score is WORSE and a higher score is BETTER. E.g., if Active Acne went from 35 down to 29, it means the acne got worse, NOT better. Always evaluate and describe these score trends correctly (increasing score is improvement, decreasing score is worsening).

LETTER GRADES: A is best, E is worst. When describing grade movement, say "slipped from grade C to D" (worse) or "improved from grade D to C" (better). Never write awkward phrases like "grade D is worse than grade C" — describe the movement instead. If two readings share the same grade but the score dipped, say "held around grade D with a small dip".

${
  !scoresUnlocked
    ? `IMPORTANT: The patient's exact scores are currently locked/hidden until their clinic visit. They ONLY see letter grades (A–E). You MUST NEVER output any exact score numbers (e.g. 72, 32, 29, 35) in observation text. Describe parameters using letter grades and plain language (e.g. "Active Acne slipped from grade C to D", "held around grade D").`
    : `SCORES: The patient's exact scores are unlocked. You can refer to exact score numbers (e.g. "Active Acne is 32").`
}

Rules for observations:
- Return 2–4 observations, ordered: (1) baseline/onboarding scan insight, (2) lifestyle from logged days in the stated window, (3) scan trend if 2+ scans exist in window, optional (4) tie-in from weekly report snippet if provided.
- Each observation must cite which data you used in dateLabel (e.g. "Baseline · 12 May", "4 days logged", "19 May vs 12 May").
- source must be one of: baseline_scan, daily_logs, scan_trend, weekly_report.
- Respect WINDOW data policy exactly (first week vs rolling 7 days).
- If no scans at all, one observation only: encourage baseline capture (still grounded in evidence).`;

  const user = `${profileContextForLlm(ctx, scoresUnlocked)}

CORRELATION SIGNALS
Wins: ${signalPack.topWins.join("; ") || "none"}
Drags: ${signalPack.topDrags.join("; ") || "none"}

TEXTBOOK EVIDENCE
${chunkLines(evidence)}

Return JSON:
{
  "observations": [
    {"text": "complete sentence", "source": "baseline_scan|daily_logs|scan_trend|weekly_report", "dateLabel": "short label"}
  ]
}`;

  const out = await callJson<LlmObservationsOut>(system, user);
  if (!out?.observations?.length) return [];

  return out.observations
    .map((o) => ({
      text: softenPatientText((o.text ?? "").replace(/\s+/g, " ").trim(), scoresUnlocked),
      source: normalizeSource(o.source ?? "baseline_scan"),
      dateLabel: (o.dateLabel ?? "").trim() || ctx.modeLabel,
    }))
    .filter((o) => o.text.length >= 20)
    .slice(0, 4);
}

export async function generateProfilePriorityActionsRag(
  ctx: ProfileInsightContext,
  sharedEvidence?: ProfileEvidence,
  scoresUnlocked = false
): Promise<{ know: string[]; do: string[] }> {
  const correlations = profileCorrelations(ctx);
  const signalPack = buildNarrativeSignalPack(correlations, ctx.behavior);
  const evidence = sharedEvidence ?? (await retrieveForProfile(ctx));
  const weak = ctx.latestScan?.params
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];

  const system = `You are kAI for SkinFit profile "Priority actions".
Ground recommendations in TEXTBOOK EVIDENCE. Use only provided patient data.
Output ONLY JSON. No generic filler like "scan weekly" without tying to their numbers.

IMPORTANT SCALE DIRECTION: All parameters are clarity/health scores from 0 to 100, where 100 is the best (healthiest) and 0 is the worst. A lower score is WORSE, a higher score is BETTER.

${
  !scoresUnlocked
    ? `IMPORTANT: The patient's exact scores are currently locked until their clinic visit. You MUST NEVER output exact score numbers. Use letter grades (A best → E worst) and plain trend words (slipped, improved, held steady).`
    : `The patient's exact scores are unlocked. You can refer to exact score numbers.`
}

know: exactly 3 short facts about THIS patient (concern, sensitivity/UV, one data-backed habit signal).
actions: exactly 3 priority actions. Each detail MUST be 3 lines:
Why: <1 sentence with their grades/trends when locked, or numbers when unlocked>
Do: <specific instruction with timing>
Target: <measurable checkpoint before next scan — no exact score targets when locked>`;

  const user = `${profileContextForLlm(ctx, scoresUnlocked)}

Weakest parameter: ${
    weak
      ? scoresUnlocked
        ? `${RAG_KAI_PARAM_LABELS[weak.key]} (${weak.value}/100)`
        : `${RAG_KAI_PARAM_LABELS[weak.key]} — grade ${patientClarityToGrade(weak.value ?? 0)} (lowest this week)`
      : "unknown"
  }
Wins: ${signalPack.topWins.join("; ") || "none"}
Drags: ${signalPack.topDrags.join("; ") || "none"}

TEXTBOOK EVIDENCE
${chunkLines(evidence)}

Return JSON:
{
  "know": ["fact1", "fact2", "fact3"],
  "actions": [
    {"title": "short title", "detail": "Why: ...\\nDo: ...\\nTarget: ..."},
    {"title": "...", "detail": "..."},
    {"title": "...", "detail": "..."}
  ]
}`;

  const out = await callJson<LlmPriorityOut>(system, user);
  const know = (out?.know ?? [])
    .map((k) => softenPatientText(k.replace(/\s+/g, " ").trim(), scoresUnlocked))
    .filter((k) => k.length >= 8)
    .slice(0, 3);
  const doActions = (out?.actions ?? [])
    .map((a) => {
      const title = (a.title ?? "").trim();
      const detail = (a.detail ?? "").trim();
      if (!title) return "";
      const raw = detail ? `${title} — ${detail}` : title;
      return softenPatientText(raw, scoresUnlocked);
    })
    .filter((t) => t.length >= 12)
    .slice(0, 3);

  return { know, do: doActions };
}

export async function buildProfileKeyObservationsLlm(
  userId: string,
  ctx?: ProfileInsightContext,
  sharedEvidence?: ProfileEvidence,
  scoresUnlocked = false
): Promise<ProfileKeyObservationsPayload> {
  const context = ctx ?? (await gatherProfileInsightContext(userId));
  const base: ProfileKeyObservationsPayload = {
    mode: context.mode,
    modeLabel: context.modeLabel,
    windowStartYmd: context.windowStartYmd,
    windowEndYmd: context.windowEndYmd,
    logDaysUsed: context.logDaysUsed,
    scanDaysUsed: context.scanDaysUsed,
    baselineScanDateYmd: context.baselineScanDateYmd,
    items: [],
    narrativeText: null,
    generatedBy: "llm_rag",
    llmUnavailable: !isKaiInsightsEnabled(),
  };

  if (!isKaiInsightsEnabled()) {
    return base;
  }

  const items = await generateProfileKeyObservationsRag(context, sharedEvidence, scoresUnlocked);
  return {
    ...base,
    items,
    narrativeText: items.length ? items.map((i) => i.text).join(" ") : null,
    llmUnavailable: items.length === 0,
  };
}

export async function buildProfilePriorityKnowDoLlm(
  userId: string,
  ctx?: ProfileInsightContext,
  sharedEvidence?: ProfileEvidence,
  scoresUnlocked = false
): Promise<{ know: string[]; do: string[]; generatedBy: "llm_rag"; llmUnavailable: boolean }> {
  const context = ctx ?? (await gatherProfileInsightContext(userId));
  if (!isKaiInsightsEnabled()) {
    return { know: [], do: [], generatedBy: "llm_rag", llmUnavailable: true };
  }
  const { know, do: doList } = await generateProfilePriorityActionsRag(context, sharedEvidence, scoresUnlocked);
  return {
    know,
    do: doList,
    generatedBy: "llm_rag",
    llmUnavailable: know.length === 0 && doList.length === 0,
  };
}
