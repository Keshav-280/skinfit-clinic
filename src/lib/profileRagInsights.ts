import { RAG_KAI_PARAM_LABELS } from "@/src/lib/ragEightParams";
import { buildNarrativeSignalPack } from "@/src/lib/ragCorrelationStats";
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

async function callJson<T>(system: string, user: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
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
  } catch (e) {
    console.error("[profileRagInsights] LLM call failed:", e);
    return null;
  }
}

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

async function retrieveForProfile(ctx: ProfileInsightContext) {
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
  ctx: ProfileInsightContext
): Promise<ProfileObservationItem[]> {
  const correlations = profileCorrelations(ctx);
  const signalPack = buildNarrativeSignalPack(correlations, ctx.behavior);
  const evidence = await retrieveForProfile(ctx);

  const system = `You are kAI, a dermatology-informed skin health counselor for SkinFit.
Ground clinical claims in TEXTBOOK EVIDENCE blocks when you explain mechanisms.
Use ONLY the patient data in the user message — never invent scan scores, dates, or log days.
Output ONLY valid JSON. No markdown.

Rules for observations:
- Return 2–4 observations, ordered: (1) baseline/onboarding scan insight, (2) lifestyle from logged days in the stated window, (3) scan trend if 2+ scans exist in window, optional (4) tie-in from weekly report snippet if provided.
- Each observation must cite which data you used in dateLabel (e.g. "Baseline · 12 May", "4 days logged", "19 May vs 12 May").
- source must be one of: baseline_scan, daily_logs, scan_trend, weekly_report.
- Respect WINDOW data policy exactly (first week vs rolling 7 days).
- If no scans at all, one observation only: encourage baseline capture (still grounded in evidence).`;

  const user = `${profileContextForLlm(ctx)}

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
      text: (o.text ?? "").replace(/\s+/g, " ").trim(),
      source: normalizeSource(o.source ?? "baseline_scan"),
      dateLabel: (o.dateLabel ?? "").trim() || ctx.modeLabel,
    }))
    .filter((o) => o.text.length >= 20)
    .slice(0, 4);
}

export async function generateProfilePriorityActionsRag(
  ctx: ProfileInsightContext
): Promise<{ know: string[]; do: string[] }> {
  const correlations = profileCorrelations(ctx);
  const signalPack = buildNarrativeSignalPack(correlations, ctx.behavior);
  const evidence = await retrieveForProfile(ctx);
  const weak = ctx.latestScan?.params
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];

  const system = `You are kAI for SkinFit profile "Priority actions".
Ground recommendations in TEXTBOOK EVIDENCE. Use only provided patient data.
Output ONLY JSON. No generic filler like "scan weekly" without tying to their numbers.

know: exactly 3 short facts about THIS patient (concern, sensitivity/UV, one data-backed habit signal).
actions: exactly 3 priority actions. Each detail MUST be 3 lines:
Why: <1 sentence with their numbers>
Do: <specific instruction with timing>
Target: <measurable checkpoint before next scan>`;

  const user = `${profileContextForLlm(ctx)}

Weakest parameter: ${weak ? `${RAG_KAI_PARAM_LABELS[weak.key]} (${weak.value}/100)` : "unknown"}
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
    .map((k) => k.replace(/\s+/g, " ").trim())
    .filter((k) => k.length >= 8)
    .slice(0, 3);
  const doActions = (out?.actions ?? [])
    .map((a) => {
      const title = (a.title ?? "").trim();
      const detail = (a.detail ?? "").trim();
      if (!title) return "";
      return detail ? `${title} — ${detail}` : title;
    })
    .filter((t) => t.length >= 12)
    .slice(0, 3);

  return { know, do: doActions };
}

export async function buildProfileKeyObservationsLlm(
  userId: string,
  ctx?: ProfileInsightContext
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
    llmUnavailable: !isLlmEnabled(),
  };

  if (!isLlmEnabled()) {
    return base;
  }

  const items = await generateProfileKeyObservationsRag(context);
  return {
    ...base,
    items,
    narrativeText: items.length ? items.map((i) => i.text).join(" ") : null,
    llmUnavailable: items.length === 0,
  };
}

export async function buildProfilePriorityKnowDoLlm(
  userId: string,
  ctx?: ProfileInsightContext
): Promise<{ know: string[]; do: string[]; generatedBy: "llm_rag"; llmUnavailable: boolean }> {
  const context = ctx ?? (await gatherProfileInsightContext(userId));
  if (!isLlmEnabled()) {
    return { know: [], do: [], generatedBy: "llm_rag", llmUnavailable: true };
  }
  const { know, do: doList } = await generateProfilePriorityActionsRag(context);
  return {
    know,
    do: doList,
    generatedBy: "llm_rag",
    llmUnavailable: know.length === 0 && doList.length === 0,
  };
}
