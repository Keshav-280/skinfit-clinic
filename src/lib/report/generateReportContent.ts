import OpenAI from "openai";
import { INITIAL_REPORT_SYSTEM_PROMPT } from "@/src/lib/report/initialReportPrompt";
import { UPDATE_REPORT_SYSTEM_PROMPT } from "@/src/lib/report/updateReportPrompt";
import { validateGeneratedReport } from "@/src/lib/reportCopyGuard";
import {
  aiReview,
  feedbackBrief,
  runVerified,
  writerModel,
} from "@/src/lib/aiVerified";

// The full-size model writing a long report takes well over 20 seconds. Too short a limit cut off
// almost every attempt and left reports without any AI text.
const TIMEOUT_MS = 150_000;

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

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(stripFences(raw)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function chatJson(
  system: string,
  userPayload: unknown,
  feedback: string[] | null = null
): Promise<{ data: Record<string, unknown> | null; source: "openai" | "fallback" }> {
  const client = getClient();
  if (!client) return { data: null, source: "fallback" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const completion = await client.chat.completions.create(
      {
        model: writerModel(),
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
          ...(feedback && feedback.length
            ? [{ role: "user" as const, content: feedbackBrief(feedback) }]
            : []),
        ],
      },
      { signal: controller.signal }
    );
    const text = completion.choices[0]?.message?.content ?? "";
    const data = parseJsonObject(text);
    return { data, source: data ? "openai" : "fallback" };
  } catch {
    return { data: null, source: "fallback" };
  } finally {
    clearTimeout(timer);
  }
}

export type GeneratedUpdateReport = {
  headline?: string;
  summary?: string;
  overall?: {
    letter?: string;
    position?: number;
    previous_letter?: string;
    previous_position?: number;
    movement?: string;
    headline?: string;
  };
  parameters?: Array<{
    key?: string;
    finding?: string;
    movement?: string;
    letter?: string;
    next_reports_on?: string | null;
  }>;
  attribution?: Array<{ factor?: string; text?: string }>;
  week_recap?: {
    sleep?: string;
    stress?: string;
    water?: string;
    routine_adherence?: string;
    highlight?: string;
  };
  actions?: Array<
    | string
    | { title?: string; detail?: string; parameter?: string; key?: string }
  >;
  next_step?: { label?: string; reason?: string; type?: string };
  share_card?: { grade?: string; line?: string };
  escalate?: boolean;
  status?: string;
};

export type GeneratedInitialReport = {
  headline?: string;
  summary?: string;
  overall?: { letter?: string; position?: number; headline?: string };
  parameters?: Array<{ key?: string; finding?: string; letter?: string }>;
  actions?: Array<
    | string
    | { title?: string; detail?: string; parameter?: string; key?: string }
  >;
  next_step?: { label?: string; reason?: string; type?: string };
  status?: string;
};

/**
 * Layer 1 writes, layer 2 (a second AI) checks, layer 3 (code) checks numbers and wording. Any
 * failure sends the whole report back to be written again, with the reasons. If no draft passes,
 * nothing is published and the caller shows no AI report.
 */
async function chatJsonValidated(system: string, payload: unknown, kind: string) {
  let source: "openai" | "fallback" = "fallback";
  const data = await runVerified<Record<string, unknown>>({
    name: kind,
    generate: async (feedback) => {
      const r = await chatJson(system, payload, feedback);
      source = r.source;
      return r.data;
    },
    review: (candidate) =>
      aiReview({
        kind: `${kind} (a patient report: headline, summary, per-area findings, actions, next step)`,
        data: payload,
        candidate,
        extraRules:
          'This report screen already shows every score, point change, date and weekly check-in figure in its own cards, so numbers are rationed. Digits are allowed ONLY in: the summary (at most two numbers, both scores or changes that are in the DATA), an action detail (the area\'s score once as "X out of 100", or a habit number such as "6 to 8 hours of sleep"), and share_card.line. FAIL the candidate if the headline, a finding, an attribution line, the week recap highlight or the next step contains a digit, or if any sentence only lists scores or the weekly check-in figures instead of adding meaning. FAIL it if two parts say the same thing. FAIL it if any doctor is named (it must say "your doctor"). FAIL it if it names an ingredient, product, treatment, device or medicine, calls a 1 or 2 point move a change, or uses internal words (pigmentation, Medixora, lesions, baseline, parameters, markers, algorithm) or filler words (lovely, great, really, just, truly). The next step label must start "Message your doctor about" or be exactly "Book an in-person visit". It must feel warm, personal and human: like a calm friend from the clinic, not a data readout, and a parent could read it once and know what to do this week.',
      }),
    codeCheck: (candidate) => validateGeneratedReport(candidate, payload),
  });
  return { data, source: data ? source : ("fallback" as const) };
}

export async function generateUpdateReportContent(
  payload: unknown
): Promise<{ report: GeneratedUpdateReport | null; aiUnavailable: boolean }> {
  const { data, source } = await chatJsonValidated(UPDATE_REPORT_SYSTEM_PROMPT, payload, "update-report");
  if (!data) return { report: null, aiUnavailable: true };
  return {
    report: data as GeneratedUpdateReport,
    aiUnavailable: source === "fallback",
  };
}

export async function generateInitialReportContent(
  payload: unknown
): Promise<{ report: GeneratedInitialReport | null; aiUnavailable: boolean }> {
  const { data, source } = await chatJsonValidated(INITIAL_REPORT_SYSTEM_PROMPT, payload, "first-scan-report");
  if (!data) return { report: null, aiUnavailable: true };
  return {
    report: data as GeneratedInitialReport,
    aiUnavailable: source === "fallback",
  };
}
