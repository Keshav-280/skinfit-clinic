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

export function buildAttributionCards(opts: {
  cityWeather: CityWeatherData | null;
  wellness: LlmWellnessCheckinInput | null;
  recentTreatmentTitle?: string | null;
  recentTreatmentDate?: string | null;
  llm?: GeneratedUpdateReport | null;
  /** Real, number-grounded patterns computed from full scan/check-in history — see multiWeekPatternAnalysis.ts. */
  multiWeekInsights?: Array<{ kind: string; text: string }>;
}): Array<{ label: string; text: string }> {
  const cards: Array<{ label: string; text: string }> = [];

  // Computed multi-week patterns are strictly more specific than the LLM's
  // generic weekly attribution — lead with them when we have any.
  if (opts.multiWeekInsights?.length) {
    const kindLabel: Record<string, string> = {
      baseline: "Since your first scan",
      trend: "What's moving (or not)",
      checkin_correlation: "What the data shows",
      comovement: "Pattern across parameters",
      consistency: "Check-ins vs. stability",
    };
    for (const insight of opts.multiWeekInsights) {
      cards.push({
        label: kindLabel[insight.kind] ?? "Your pattern so far",
        text: insight.text,
      });
      if (cards.length >= 3) break;
    }
    if (cards.length >= 3) return cards;
  }

  if (opts.llm?.attribution?.length) {
    for (const a of opts.llm.attribution) {
      if (!a?.text?.trim()) continue;
      const factor = (a.factor ?? "").toLowerCase();
      const label =
        factor.includes("clinic") || factor.includes("treatment")
          ? "Your clinic record"
          : factor.includes("environ") || factor.includes("weather")
            ? opts.cityWeather
              ? `${opts.cityWeather.city} this week`
              : "Environment this week"
            : "Your pattern so far";
      cards.push({ label, text: a.text.trim() });
    }
    if (cards.length > 0) return cards.slice(0, 3);
  }

  if (opts.recentTreatmentTitle) {
    const when = opts.recentTreatmentDate
      ? ` (${opts.recentTreatmentDate})`
      : "";
    cards.push({
      label: "Your clinic record",
      text: `Your recent plan includes “${opts.recentTreatmentTitle}”${when}. If you're still settling after a clinic treatment, mild texture or flaking can read as change without meaning damage.`,
    });
  }

  if (opts.cityWeather) {
    const w = opts.cityWeather;
    const aqiBit =
      w.aqi != null ? ` AQI around ${w.aqi}.` : "";
    cards.push({
      label: `${w.city} this week`,
      text: `${w.city} is reading about ${w.tempC}°C with ${w.humidity}% humidity and UV index ${w.uvIndex} (${w.condition}).${aqiBit} Dry or humid swings often show up as tightness or oiliness before they show as breakouts.`,
    });
  }

  if (opts.wellness) {
    const sleep = opts.wellness.sleepHours?.trim();
    const stress = stressLabel(opts.wellness.stressLevel);
    cards.push({
      label: "Your pattern so far",
      text: sleep
        ? `This week you logged ${sleep} of sleep and stress as ${stress.toLowerCase()}. We'll keep pairing these with the markers that move on a weekly cycle - it's a pattern to watch, not a conclusion.`
        : "Complete your weekly check-ins to see patterns here.",
    });
  } else {
    cards.push({
      label: "Your pattern so far",
      text: "Complete your weekly check-ins to see patterns here.",
    });
  }

  return cards.slice(0, 3);
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
  score10: string,
  rows: KaiReportParamRow[],
  movement: "improved" | "holding" | "declined"
): string {
  const top = pickTopConcernName(rows).toLowerCase();
  const label = /\/10$/.test(score10) ? score10 : `${score10}/10`;
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
  score10: string,
  movement: "improved" | "holding" | "declined",
  topConcern: string
): string {
  const label = /\/10$/.test(score10) ? score10 : `${score10}/10`;
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
