import type { LlmWellnessCheckinInput } from "@/src/lib/ragLlmAnalysis";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { computeScore10Movement } from "@/src/lib/report/gradeComputation";
import type { MultiWeekInsight } from "@/src/lib/multiWeekPatternAnalysis";

export type ReportFocusAction = {
  title: string;
  detail: string;
  parameter?: string;
};

type LlmActionRaw =
  | string
  | {
      title?: unknown;
      detail?: unknown;
      parameter?: unknown;
      key?: unknown;
    };

const STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "your",
  "week",
  "next",
  "keep",
  "into",
  "about",
  "have",
  "will",
  "them",
  "they",
  "for",
  "and",
  "the",
  "you",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function overlapRatio(a: string, b: string): number {
  const aa = new Set(tokens(a));
  const bb = new Set(tokens(b));
  if (aa.size === 0 || bb.size === 0) return 0;
  let hit = 0;
  for (const t of aa) if (bb.has(t)) hit += 1;
  return hit / Math.min(aa.size, bb.size);
}

function sameInsight(a: string, b: string): boolean {
  const na = a.replace(/\s+/g, " ").trim().toLowerCase();
  const nb = b.replace(/\s+/g, " ").trim().toLowerCase();
  if (!na || !nb) return true;
  if (na === nb) return true;
  if (na.startsWith(nb) || nb.startsWith(na)) return true;
  return overlapRatio(na, nb) >= 0.72;
}

function cleanSentence(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/** Title is a short verb phrase; detail is the how - never a copy of the title. */
export function splitActionText(text: string): ReportFocusAction {
  const raw = cleanSentence(text);
  const parts = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  const title = (parts[0] ?? raw).replace(/[.]+$/, "").trim();
  const rest = parts.slice(1).join(" ").trim();
  if (!rest || sameInsight(title, rest) || sameInsight(title, raw)) {
    return { title, detail: "" };
  }
  return { title, detail: rest };
}

function asAction(raw: LlmActionRaw): ReportFocusAction | null {
  if (typeof raw === "string" && raw.trim()) {
    const split = splitActionText(raw);
    if (!split.title || !split.detail) return null;
    return split;
  }
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? cleanSentence(raw.title) : "";
  const detail = typeof raw.detail === "string" ? cleanSentence(raw.detail) : "";
  const parameter =
    typeof raw.parameter === "string"
      ? raw.parameter
      : typeof raw.key === "string"
        ? raw.key
        : undefined;
  if (!title || !detail || sameInsight(title, detail)) return null;
  return {
    title: title.replace(/[.]+$/, ""),
    detail,
    parameter,
  };
}

export function parseLlmFocusActions(raw: unknown): ReportFocusAction[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportFocusAction[] = [];
  const seenParams = new Set<string>();
  for (const item of raw) {
    const action = asAction(item as LlmActionRaw);
    if (!action) continue;
    if (out.some((a) => sameInsight(a.title, action.title))) continue;
    if (out.some((a) => action.detail && sameInsight(a.detail, action.detail))) {
      continue;
    }
    const param = action.parameter?.trim();
    if (param) {
      const key = param.toLowerCase();
      if (seenParams.has(key)) continue;
      seenParams.add(key);
    }
    out.push(action);
    if (out.length >= 3) break;
  }
  return out;
}

function checkinBits(w: LlmWellnessCheckinInput | null | undefined) {
  const nutrition =
    w?.nutritionLevel?.trim() ||
    (w?.nutritionMulti?.length ? w.nutritionMulti.join(", ") : "");
  const sleep = w?.sleepHours?.trim() || "";
  const stress =
    w?.stressAnchor?.trim() ||
    (w?.stressLevel != null ? `stress ${w.stressLevel}/10` : "");
  const water = w?.water?.trim() || "";
  const exercise = w?.exerciseHours?.trim() || "";
  const routine = w?.skincareRoutine?.length
    ? w.skincareRoutine.join(", ")
    : "";
  const actives = w?.activeIngredients?.trim() || "";
  const supplements =
    w?.supplementsList?.length
      ? w.supplementsList.join(", ")
      : w?.supplements?.trim() || "";
  return { nutrition, sleep, stress, water, exercise, routine, actives, supplements };
}

function templateForParam(
  row: KaiReportParamRow,
  prev: KaiReportParamRow | undefined,
  w: LlmWellnessCheckinInput | null | undefined,
  multiWeekInsight?: MultiWeekInsight
): ReportFocusAction {
  const base = baseTemplateForParam(row, prev, w);
  if (!multiWeekInsight?.text) return base;
  // base.detail always opens with "X is N/10 (trend)." — the insight already
  // states the score/trend with more evidence, so drop that clause instead
  // of saying the same number twice in one card.
  const withoutScoreLine = base.detail.replace(/^[^.]+\.\s*/, "");
  return {
    ...base,
    detail: `${multiWeekInsight.text} ${withoutScoreLine}`.trim(),
  };
}

function baseTemplateForParam(
  row: KaiReportParamRow,
  prev: KaiReportParamRow | undefined,
  w: LlmWellnessCheckinInput | null | undefined
): ReportFocusAction {
  const bits = checkinBits(w);
  const score = `${row.score10}/10`;
  const moved = prev
    ? computeScore10Movement(row.score10, prev.score10)
    : "holding";
  const trend =
    moved === "improved"
      ? `up from ${prev!.score10}/10`
      : moved === "declined"
        ? `down from ${prev!.score10}/10`
        : "holding vs last scan";
  const key = row.key;

  if (key === "active_acne") {
    const dietBit = bits.nutrition
      ? `You logged ${bits.nutrition.toLowerCase()} this week`
      : "Your check-in did not flag diet this week";
    return {
      parameter: key,
      title: "Keep new breakouts from stacking",
      detail: `Active acne is ${score} (${trend}). ${dietBit} - pair a gentle cream cleanse with one non-negotiable night step rather than adding a new active.`,
    };
  }
  if (key === "pigmentation") {
    return {
      parameter: key,
      title: "Shield pigment during peak daylight",
      detail: `Pigmentation is ${score} (${trend}). ${
        bits.actives
          ? `You are already using ${bits.actives}`
          : bits.routine
            ? `Routine this week: ${bits.routine}`
            : "No brightening active was logged"
      } - SPF at 9am and a midday reapply on outdoor days matters more than adding another serum.`,
    };
  }
  if (key === "wrinkles") {
    return {
      parameter: key,
      title: "Give expression lines a calmer night",
      detail: `Wrinkles sit at ${score} (${trend}). ${
        bits.sleep
          ? `Sleep was logged as ${bits.sleep}`
          : bits.stress
            ? `Stress was logged as ${bits.stress.toLowerCase()}`
            : "Sleep and stress were not logged"
      } - a fixed wind-down and 7 hours in bed is the weekly lever for this marker.`,
    };
  }
  if (key === "under_eye") {
    return {
      parameter: key,
      title: "Settle under-eyes with sleep, not extra cream",
      detail: `Under eye is ${score} (${trend}). ${
        bits.water
          ? `Water intake was ${bits.water}`
          : bits.sleep
            ? `Sleep was ${bits.sleep}`
            : "Sleep and water were not logged"
      } - keep one cool-hour bedtime and skip stacking a new eye product this week.`,
    };
  }
  if (key === "sagging_volume") {
    return {
      parameter: key,
      title: "Support volume with protein and resistance",
      detail: `Sagging and volume is ${score} (${trend}). ${
        bits.nutrition
          ? `Diet this week: ${bits.nutrition.toLowerCase()}`
          : bits.exercise
            ? `Exercise logged at ${bits.exercise}`
            : "Diet and exercise were not logged"
      } - keep protein at meals and two short resistance sessions rather than changing skincare.`,
    };
  }
  if (key === "acne_scars") {
    return {
      parameter: key,
      title: "Hold the scar plan steady",
      detail: `Acne scars are ${score} (${trend}). ${
        bits.actives
          ? `Logged actives: ${bits.actives}`
          : bits.routine
            ? `Routine: ${bits.routine}`
            : "No scar-specific active was logged"
      } - scars move slowly, so keep the same night step and the same scan lighting next week.`,
    };
  }
  return {
    parameter: key,
    title: `Work ${row.shortName.toLowerCase()} with one weekly habit`,
    detail: `${row.name} is ${score} (${trend}). Tie one check-in habit (sleep, SPF, or a single routine step) to this marker only - do not reuse advice from the other two steps.`,
  };
}

export function defaultFocusActions(opts: {
  rows: KaiReportParamRow[];
  previousRows?: KaiReportParamRow[];
  wellness?: LlmWellnessCheckinInput | null;
  multiWeekInsights?: MultiWeekInsight[];
}): ReportFocusAction[] {
  const prevByKey = new Map((opts.previousRows ?? []).map((p) => [p.key, p]));
  const insightByParam = new Map<string, MultiWeekInsight>(
    (opts.multiWeekInsights ?? [])
      .filter((i): i is MultiWeekInsight & { param: string } => !!i.param)
      .map((i) => [i.param as string, i])
  );
  const ranked = [...opts.rows].sort((a, b) => {
    if (a.score10 !== b.score10) return a.score10 - b.score10;
    return b.severity - a.severity;
  });
  const out: ReportFocusAction[] = [];
  for (const row of ranked) {
    const action = templateForParam(
      row,
      prevByKey.get(row.key),
      opts.wellness,
      insightByParam.get(row.key)
    );
    if (out.some((a) => sameInsight(a.title, action.title))) continue;
    if (out.some((a) => sameInsight(a.detail, action.detail))) continue;
    out.push(action);
    if (out.length >= 3) break;
  }
  return out;
}

export function coalesceFocusActions(opts: {
  llmActions: unknown;
  rows: KaiReportParamRow[];
  previousRows?: KaiReportParamRow[];
  wellness?: LlmWellnessCheckinInput | null;
  multiWeekInsights?: MultiWeekInsight[];
}): ReportFocusAction[] {
  const parsed = parseLlmFocusActions(opts.llmActions);
  if (parsed.length >= 3) return parsed.slice(0, 3);
  const fallback = defaultFocusActions(opts);
  const merged = [...parsed];
  for (const extra of fallback) {
    if (merged.length >= 3) break;
    if (merged.some((a) => sameInsight(a.title, extra.title))) continue;
    if (
      extra.parameter &&
      merged.some(
        (a) => a.parameter && a.parameter.toLowerCase() === extra.parameter!.toLowerCase()
      )
    ) {
      continue;
    }
    merged.push(extra);
  }
  return merged.slice(0, 3);
}
