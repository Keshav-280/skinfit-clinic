import OpenAI from "openai";
import { INITIAL_REPORT_SYSTEM_PROMPT } from "@/src/lib/report/initialReportPrompt";
import { UPDATE_REPORT_SYSTEM_PROMPT } from "@/src/lib/report/updateReportPrompt";

const TIMEOUT_MS = 5000;

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
  userPayload: unknown
): Promise<{ data: Record<string, unknown> | null; source: "openai" | "fallback" }> {
  const client = getClient();
  if (!client) return { data: null, source: "fallback" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const completion = await client.chat.completions.create(
      {
        model: model(),
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
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
  actions?: string[];
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
  actions?: string[];
  next_step?: { label?: string; reason?: string; type?: string };
  status?: string;
};

export async function generateUpdateReportContent(
  payload: unknown
): Promise<{ report: GeneratedUpdateReport | null; aiUnavailable: boolean }> {
  const { data, source } = await chatJson(UPDATE_REPORT_SYSTEM_PROMPT, payload);
  if (!data) return { report: null, aiUnavailable: true };
  return {
    report: data as GeneratedUpdateReport,
    aiUnavailable: source === "fallback",
  };
}

export async function generateInitialReportContent(
  payload: unknown
): Promise<{ report: GeneratedInitialReport | null; aiUnavailable: boolean }> {
  const { data, source } = await chatJson(INITIAL_REPORT_SYSTEM_PROMPT, payload);
  if (!data) return { report: null, aiUnavailable: true };
  return {
    report: data as GeneratedInitialReport,
    aiUnavailable: source === "fallback",
  };
}
