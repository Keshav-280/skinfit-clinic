import { format } from "date-fns";
import type { CityWeatherData } from "@/src/lib/cityWeather";
import type { LlmWellnessCheckinInput } from "@/src/lib/ragLlmAnalysis";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import {
  defaultInitialActions,
  pickTopConcernName,
} from "@/src/lib/kaiReportMapping";
import type { GeneratedUpdateReport } from "@/src/lib/report/generateReportContent";

const STRESS_ANCHORS: Record<number, string> = {
  1: "Calm",
  2: "Calm",
  3: "Mostly fine",
  4: "Mostly fine",
  5: "Mixed",
  6: "Strained",
  7: "Strained",
  8: "Overwhelmed",
  9: "Overwhelmed",
  10: "Overwhelmed",
};

export function stressLabel(level: number | null | undefined): string {
  if (level == null || !Number.isFinite(level)) return "-";
  const n = Math.max(1, Math.min(10, Math.round(level)));
  return STRESS_ANCHORS[n] ?? "Mixed";
}

export function weekRecapFromWellness(
  wellness: LlmWellnessCheckinInput | null
): Array<{ label: string; value: string }> {
  if (!wellness) {
    return [
      { label: "Sleep", value: "-" },
      { label: "Stress", value: "-" },
      { label: "Routine", value: "-" },
      { label: "Fuel", value: "-" },
    ];
  }
  const routine = Array.isArray(wellness.skincareRoutine)
    ? wellness.skincareRoutine.length > 0
      ? `${wellness.skincareRoutine.length} steps`
      : "-"
    : "-";
  return [
    { label: "Sleep", value: wellness.sleepHours?.trim() || "-" },
    { label: "Stress", value: stressLabel(wellness.stressLevel) },
    { label: "Routine", value: routine },
    {
      label: "Fuel",
      value: wellness.nutritionLevel?.trim() || "-",
    },
  ];
}

export function templateWeekHighlight(
  wellness: LlmWellnessCheckinInput | null
): string | null {
  if (!wellness?.sleepHours?.trim()) return null;
  return `You logged ${wellness.sleepHours.trim()} of sleep this week - we'll keep watching how that sits with your markers.`;
}

/**
 * "Likely factors" cards. Every card is text the AI wrote and that passed the checks in
 * aiVerified.ts; code adds no sentences of its own. The weather, treatments, check-in and history
 * patterns are given to the AI as data, so it can mention them in its own words.
 * With no AI text there are no cards.
 */
export function buildAttributionCards(opts: {
  cityWeather?: CityWeatherData | null;
  wellness?: LlmWellnessCheckinInput | null;
  recentTreatmentTitle?: string | null;
  recentTreatmentDate?: string | null;
  llm?: GeneratedUpdateReport | null;
  multiWeekInsights?: Array<{ kind: string; text: string }>;
}): Array<{ label: string; text: string }> {
  const cards: Array<{ label: string; text: string }> = [];
  for (const a of opts.llm?.attribution ?? []) {
    if (cards.length >= 3) break;
    const text = a?.text?.trim();
    if (!text) continue;
    const factor = (a.factor ?? "").toLowerCase();
    const label =
      factor.includes("clinic") || factor.includes("treatment")
        ? "Your clinic record"
        : factor.includes("environ") || factor.includes("weather")
          ? "Your surroundings"
          : factor.includes("sleep") || factor.includes("stress") || factor.includes("check")
            ? "Your week"
            : "Your pattern so far";
    cards.push({ label: cards.some((c) => c.label === label) ? `${label} (${cards.length + 1})` : label, text });
  }
  return cards;
}

export function defaultUpdateActions(opts: {
  topConcern: string;
  hasCaptureNote?: boolean;
}): string[] {
  const base = defaultInitialActions(opts.topConcern).slice(0, 2);
  const third = opts.hasCaptureNote
    ? "Next capture: same distance, face the light (don't stand with a bright window behind you)."
    : "Keep capture conditions consistent - same lighting and distance - so next week's then/now stays reliable.";
  return [...base, third];
}

export function defaultUpdateHeadline(
  score100: string,
  rows: KaiReportParamRow[],
  movement: "improved" | "holding" | "declined"
): string {
  const top = pickTopConcernName(rows).toLowerCase();
  const label = /\/100$/.test(score100) ? score100 : `${score100}/100`;
  if (movement === "improved") {
    return `${label} - ${top} easing, rest holding`;
  }
  if (movement === "declined") {
    return `${label} - watch ${top}, rest holding`;
  }
  return `${label} - holding steady on ${top}`;
}

export function defaultNextStep(opts: {
  doctorName: string;
  topConcern: string;
  escalate?: boolean;
}): { heading: string; body: string } {
  if (opts.escalate) {
    return {
      heading: `${opts.doctorName} should review this scan`,
      body: `Something on this week's capture is worth a direct look - message ${opts.doctorName} with this report open so they can advise next steps.`,
    };
  }
  return {
    heading: `${opts.doctorName} should see your ${opts.topConcern.toLowerCase()} progress`,
    body: `A quick message keeps your plan aligned with what this week actually shows - not just how it feels day to day.`,
  };
}

export function formatShareLine(
  weekNumber: number,
  score100: string,
  movement: "improved" | "holding" | "declined",
  topConcern: string
): string {
  const label = /\/100$/.test(score100) ? score100 : `${score100}/100`;
  const mv =
    movement === "improved"
      ? `${topConcern} improving`
      : movement === "declined"
        ? `Watch ${topConcern.toLowerCase()}`
        : "Holding steady";
  return `Week ${weekNumber} · ${label} · ${mv}`;
}

export function formatScanDateShort(d: Date): string {
  return format(d, "d MMM");
}
