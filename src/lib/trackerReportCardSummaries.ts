/**
 * Auto-generated 1–2 sentence summaries for progressive report cards.
 */

import type {
  PatientTrackerCause,
  PatientTrackerFocusAction,
  PatientTrackerParamRow,
  PatientTrackerReport,
  TrackerCityWeatherSnapshot,
  TrackerWellnessSnapshot,
} from "@/src/lib/patientTrackerReport.types";
import { trackerParamRowDisplayDelta } from "@/src/lib/trackerDisplayDelta";

function parseCauseTag(text: string): {
  tag: "win" | "drag" | "watch" | "environment" | null;
  body: string;
} {
  const m = text.trim().match(/^(Win|Drag|Watch|Environment):\s*(.*)$/i);
  if (!m) return { tag: null, body: text.trim() };
  const raw = m[1]!.toLowerCase();
  const tag =
    raw === "win"
      ? "win"
      : raw === "drag"
        ? "drag"
        : raw === "watch"
          ? "watch"
          : "environment";
  return { tag, body: (m[2] ?? "").trim() || text.trim() };
}

function aqiBand(aqi: number | null): string {
  if (aqi == null) return "air quality unavailable";
  if (aqi <= 50) return "good air quality";
  if (aqi <= 100) return "moderate air pollution";
  if (aqi <= 150) return "unhealthy-for-sensitive air pollution";
  if (aqi <= 200) return "unhealthy air pollution";
  return "hazardous air pollution";
}

function monsoonOrSeasonHint(w: TrackerCityWeatherSnapshot): string {
  if (w.humidity >= 75 && w.condition.toLowerCase().includes("rain")) {
    return "monsoon moisture";
  }
  if (w.humidity >= 70) return "high humidity";
  if (w.humidity <= 35) return "dry air";
  if (w.tempC >= 32) return "heat stress";
  if (w.tempC <= 15) return "cool, dry conditions";
  return w.condition.toLowerCase();
}

export function summarizeEnvironmentCard(
  weather: TrackerCityWeatherSnapshot | null | undefined,
  causes: PatientTrackerCause[]
): string {
  if (!weather) {
    const envCause = causes
      .map((c) => parseCauseTag(c.text))
      .find((c) => c.tag === "environment");
    if (envCause?.body) return envCause.body;
    return "City weather wasn’t available for this week’s report. Complete your wellness check-in with a city to unlock environment insights.";
  }
  const aqiBit =
    weather.aqi != null ? `AQI ${weather.aqi}` : "AQI unavailable";
  return `${weather.city} at ${weather.tempC}°C, ${weather.humidity}% humidity, ${aqiBit}. Your skin is dealing with ${monsoonOrSeasonHint(weather)} and ${aqiBand(weather.aqi)}.`;
}

export function summarizeCausesCard(causes: PatientTrackerCause[]): string {
  if (causes.length === 0) {
    return "No cause analysis yet for this scan.";
  }
  let wins = 0;
  let drags = 0;
  let env = 0;
  let watches = 0;
  let topWin: string | null = null;
  for (const c of causes) {
    const { tag, body } = parseCauseTag(c.text);
    if (tag === "win") {
      wins += 1;
      if (!topWin) topWin = body;
    } else if (tag === "drag") drags += 1;
    else if (tag === "environment") env += 1;
    else if (tag === "watch") watches += 1;
  }
  const parts: string[] = [];
  if (wins) parts.push(`${wins} win${wins === 1 ? "" : "s"}`);
  if (drags) parts.push(`${drags} drag${drags === 1 ? "" : "s"}`);
  if (env) parts.push(`${env} environmental factor${env === 1 ? "" : "s"}`);
  if (watches && parts.length < 3) {
    parts.push(`${watches} watch`);
  }
  const head = parts.length ? parts.join(", ") : `${causes.length} factors`;
  const highlight = topWin
    ? topWin.length > 72
      ? `${topWin.slice(0, 69)}…`
      : topWin
    : "Review the details for what moved your skin.";
  return `${head.charAt(0).toUpperCase()}${head.slice(1)}. ${highlight}`;
}

export function summarizeWellnessCard(
  wellness: TrackerWellnessSnapshot | null | undefined
): string {
  if (!wellness) {
    return "No wellness check-in this week. Fill it on Maintain to connect lifestyle with your next scan.";
  }
  const bits: string[] = [];
  if (wellness.nutritionLevel) bits.push(`${wellness.nutritionLevel} diet`);
  if (wellness.sleepHours) bits.push(`${wellness.sleepHours}h sleep`);
  if (wellness.stressLevel != null) bits.push(`stress at ${wellness.stressLevel}/10`);
  if (wellness.skincareRoutine?.length) {
    bits.push(`routine ${wellness.skincareRoutine.length} of 4 steps`);
  }
  if (wellness.exerciseHours) bits.push(`${wellness.exerciseHours}h exercise`);
  if (bits.length === 0) {
    return "Wellness check-in submitted — open for the full lifestyle snapshot.";
  }
  return `${bits.slice(0, 4).join(", ")}.`;
}

export function summarizeFocusCard(actions: PatientTrackerFocusAction[]): string {
  const titles = actions.slice(0, 3).map((a) => a.title.trim()).filter(Boolean);
  if (titles.length === 0) return "No focus actions for this week yet.";
  const short = titles.map((t) =>
    t.length > 36 ? `${t.slice(0, 33)}…` : t.toLowerCase()
  );
  return `${titles.length} action${titles.length === 1 ? "" : "s"}: ${short.join(", ")}.`;
}

export function summarizeKaiInsightCard(
  hookSentence: string,
  insightText: string
): string {
  const hook = hookSentence.trim();
  if (hook) return hook;
  const insight = insightText.trim();
  if (insight) {
    return insight.length > 140 ? `${insight.slice(0, 137)}…` : insight;
  }
  return "Your personalized kAI insight will appear here after analysis.";
}

export function summarizeParamsCard(
  report: PatientTrackerReport,
  rows: PatientTrackerParamRow[],
  scoresUnlocked: boolean
): string {
  if (rows.length === 0) return "Parameter scores will appear after your scan is analyzed.";
  const bits = rows
    .map((row) => {
      const d = trackerParamRowDisplayDelta(report, row);
      const label = row.label.replace(/\s+/g, " ").trim();
      if (d == null || Math.abs(d) < 1) return `${label} steady`;
      if (!scoresUnlocked) {
        return `${label} ${d > 0 ? "↑" : "↓"}`;
      }
      return `${label} ${d > 0 ? `+${d}` : `${d}`}`;
    })
    .slice(0, 5);
  return bits.join(", ");
}

export function wellnessImpactLine(
  field: string,
  value: string
): string {
  const v = value.toLowerCase();
  if (field === "nutrition") {
    if (v.includes("protein")) return "Supports collagen and repair.";
    if (v.includes("outside")) return "Higher oil/sodium may nudge breakouts.";
    return "Diet patterns show up in barrier and tone over weeks.";
  }
  if (field === "sleep") {
    if (v.includes("<4") || v.startsWith("4")) return "Short sleep can soften barrier recovery.";
    return "Steady sleep backs overnight repair.";
  }
  if (field === "stress") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 7) return "High stress often tracks with flares.";
    return "Moderate stress — keep wind-down habits.";
  }
  if (field === "routine") {
    return "Consistent steps compound week to week.";
  }
  if (field === "exercise") {
    return "Movement helps circulation; rinse sweat after workouts.";
  }
  if (field === "supplements") {
    return "Actives + supplements can reinforce pigment and barrier goals.";
  }
  if (field === "actives") {
    return "Match actives to your weakest parameter this week.";
  }
  return "Logged for correlation with your scan.";
}

export { parseCauseTag };
