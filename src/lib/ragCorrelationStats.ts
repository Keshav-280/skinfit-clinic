import type { dailyLogs } from "@/src/db/schema";
import {
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";

type LogRow = typeof dailyLogs.$inferSelect;

export type BehaviorSnapshot = {
  windowDays: number;
  logCount: number;
  amRoutineDays: number;
  pmRoutineDays: number;
  fullRoutineDays: number;
  routineConsistencyPct: number;
  /** Mean AM checklist completion (0–100) across logged rows in-window. */
  avgAmRoutineStepPct: number;
  /** Mean PM checklist completion (0–100). */
  avgPmRoutineStepPct: number;
  /** Blend of AM+PM step completion per day then averaged across logs (0–100). */
  routineWeightedConsistencyPct: number;
  /** Journal rows ÷ calendar window × 100 when window describes a month-span. */
  journalCompliancePct: number;
  /** windowDays − days with journal text (assuming one log row per tracked day max). */
  journalMissedDays: number;
  avgSleepHours: number;
  avgWaterGlasses: number;
  avgStress: number;
  highStressDays: number;
  highSunDays: number;
  moderateSunDays: number;
  moodDistribution: Record<string, number>;
  journalEntriesCount: number;
};

/** Per-side completion from granular steps when present; otherwise legacy booleans → 100/0. */
export function routineSideCompletionPct(
  steps: boolean[] | null | undefined,
  legacyMarkedComplete: boolean
): number {
  if (steps && steps.length > 0) {
    return Math.round(
      (steps.filter(Boolean).length / steps.length) * 100
    );
  }
  return legacyMarkedComplete ? 100 : 0;
}

export function dailyRoutineBlendPctFromLog(l: LogRow): number {
  const am = routineSideCompletionPct(l.routineAmSteps, l.amRoutine);
  const pm = routineSideCompletionPct(l.routinePmSteps, l.pmRoutine);
  return Math.round((am + pm) / 2);
}

function routineSideFullyDone(l: LogRow, side: "am" | "pm"): boolean {
  if (side === "am") {
    const st = l.routineAmSteps;
    return st && st.length > 0 ? st.every(Boolean) : l.amRoutine;
  }
  const st = l.routinePmSteps;
  return st && st.length > 0 ? st.every(Boolean) : l.pmRoutine;
}

export function summarizeBehavior(
  logs: LogRow[],
  windowDays: number
): BehaviorSnapshot {
  const mood: Record<string, number> = {};
  let am = 0;
  let pm = 0;
  let full = 0;
  let sleep = 0;
  let sleepSamples = 0;
  let water = 0;
  let waterSamples = 0;
  let stress = 0;
  let stressSamples = 0;
  let highStress = 0;
  let highSun = 0;
  let modSun = 0;
  let journals = 0;
  let blendSum = 0;
  let amPctSum = 0;
  let pmPctSum = 0;
  for (const l of logs) {
    blendSum += dailyRoutineBlendPctFromLog(l);
    amPctSum += routineSideCompletionPct(l.routineAmSteps, l.amRoutine);
    pmPctSum += routineSideCompletionPct(l.routinePmSteps, l.pmRoutine);
    if (routineSideFullyDone(l, "am")) am += 1;
    if (routineSideFullyDone(l, "pm")) pm += 1;
    if (routineSideFullyDone(l, "am") && routineSideFullyDone(l, "pm"))
      full += 1;
    if (typeof l.sleepHours === "number") {
      sleep += l.sleepHours;
      sleepSamples += 1;
    }
    if (typeof l.waterGlasses === "number") {
      water += l.waterGlasses;
      waterSamples += 1;
    }
    if (typeof l.stressLevel === "number") {
      stress += l.stressLevel;
      stressSamples += 1;
      if (l.stressLevel >= 7) highStress += 1;
    }
    if (l.sunExposure === "high") highSun += 1;
    if (l.sunExposure === "moderate") modSun += 1;
    if (l.mood) mood[l.mood] = (mood[l.mood] ?? 0) + 1;
    if (l.journalEntry && l.journalEntry.trim().length > 0) journals += 1;
  }
  const n = logs.length;
  const journalCompliancePct = windowDays
    ? Math.min(100, Math.round((journals / windowDays) * 100))
    : 0;
  return {
    windowDays,
    logCount: logs.length,
    amRoutineDays: am,
    pmRoutineDays: pm,
    fullRoutineDays: full,
    routineConsistencyPct: Math.round((full / windowDays) * 100),
    avgAmRoutineStepPct: n ? Math.round(amPctSum / n) : 0,
    avgPmRoutineStepPct: n ? Math.round(pmPctSum / n) : 0,
    routineWeightedConsistencyPct: n ? Math.round(blendSum / n) : 0,
    journalCompliancePct,
    journalMissedDays: Math.max(0, windowDays - journals),
    avgSleepHours: sleepSamples > 0 ? +(sleep / sleepSamples).toFixed(1) : 0,
    avgWaterGlasses:
      waterSamples > 0 ? +(water / waterSamples).toFixed(1) : 0,
    avgStress: stressSamples > 0 ? +(stress / stressSamples).toFixed(1) : 0,
    highStressDays: highStress,
    highSunDays: highSun,
    moderateSunDays: modSun,
    moodDistribution: mood,
    journalEntriesCount: journals,
  };
}

export type BehaviorParamCorrelation = {
  paramKey: RagKaiParamKey;
  paramLabel: string;
  paramDelta: number | null;
  polarity: "improvement" | "drag" | "stable" | "unknown";
  wins: string[]; // drivers that plausibly helped this param
  drags: string[]; // drivers that plausibly hurt this param
  /** Combined view, kept for backwards compat — we now also surface wins/drags separately. */
  likelyDrivers: string[];
};

function polarityOf(delta: number | null): BehaviorParamCorrelation["polarity"] {
  if (delta == null) return "unknown";
  if (delta >= 3) return "improvement";
  if (delta <= -3) return "drag";
  return "stable";
}

/**
 * Rule-augmented correlation for ONE parameter. Produces two parallel
 * lists — wins and drags — so the downstream narrative can balance
 * what went well vs what hurt, regardless of delta sign.
 */
export function correlateBehaviorToDelta(
  paramKey: RagKaiParamKey,
  paramDelta: number | null,
  behavior: BehaviorSnapshot
): BehaviorParamCorrelation {
  const wins: string[] = [];
  const drags: string[] = [];
  const routineGap = Math.max(
    0,
    behavior.windowDays - behavior.fullRoutineDays
  );
  const polarity = polarityOf(paramDelta);
  const deltaText =
    paramDelta == null
      ? "n/a"
      : paramDelta >= 0
        ? `+${paramDelta}`
        : `${paramDelta}`;

  // ---- Routine signals (apply to most params) ----
  if (behavior.fullRoutineDays >= 5) {
    wins.push(
      `${behavior.fullRoutineDays}/${behavior.windowDays} full-routine days supported this parameter`
    );
  }
  if (routineGap >= 3) {
    drags.push(
      `routine was incomplete on ${routineGap}/${behavior.windowDays} days (AM or PM missed)`
    );
  }
  if (behavior.amRoutineDays < 4) {
    drags.push(
      `AM routine completed only ${behavior.amRoutineDays}/${behavior.windowDays} days`
    );
  }
  if (behavior.pmRoutineDays < 4) {
    drags.push(
      `PM routine completed only ${behavior.pmRoutineDays}/${behavior.windowDays} days`
    );
  }
  if (
    behavior.routineWeightedConsistencyPct > 0 &&
    behavior.routineWeightedConsistencyPct < 55
  ) {
    drags.push(
      `checklist completion averaged ~${behavior.routineWeightedConsistencyPct}% (lots of partial AM/PM finishes) — that usually drags pigment/acne pacing`
    );
  }
  if (behavior.avgPmRoutineStepPct > 0 && behavior.avgPmRoutineStepPct < 50) {
    drags.push(
      `PM steps were finished only ~${behavior.avgPmRoutineStepPct}% on average (evenings tend to collapse first)`
    );
  }
  if (behavior.journalCompliancePct > 0 && behavior.journalCompliancePct < 40) {
    drags.push(
      `journal only landed on ~${behavior.journalCompliancePct}% of days (${behavior.journalEntriesCount}/${behavior.windowDays}) — missing triggers/link to flares`
    );
  }

  // ---- Sleep ----
  if (behavior.avgSleepHours >= 7) {
    wins.push(
      `avg sleep ${behavior.avgSleepHours}h supported barrier repair`
    );
  } else if (behavior.avgSleepHours > 0 && behavior.avgSleepHours < 6) {
    drags.push(
      `low avg sleep ${behavior.avgSleepHours}h weakens overnight recovery`
    );
  }

  // ---- Hydration ----
  if (behavior.avgWaterGlasses >= 7) {
    wins.push(`hydration ${behavior.avgWaterGlasses} glasses/day was healthy`);
  } else if (
    behavior.avgWaterGlasses > 0 &&
    behavior.avgWaterGlasses < 5
  ) {
    drags.push(
      `hydration only ${behavior.avgWaterGlasses} glasses/day may reduce skin suppleness`
    );
  }

  // ---- Sun exposure ----
  if (behavior.highSunDays === 0) {
    if (paramKey === "pigmentation" || paramKey === "wrinkles") {
      wins.push("zero high-UV days helped protect pigmentation and photo-aging");
    }
  } else if (behavior.highSunDays >= 2) {
    if (paramKey === "pigmentation" || paramKey === "wrinkles") {
      drags.push(
        `${behavior.highSunDays} high-UV days likely pressured ${RAG_KAI_PARAM_LABELS[paramKey].toLowerCase()}`
      );
    }
  }

  // ---- Stress ----
  if (behavior.highStressDays === 0 && behavior.avgStress > 0) {
    if (paramKey === "active_acne" || paramKey === "under_eye") {
      wins.push(
        `no high-stress days (avg ${behavior.avgStress}/10) helped keep ${RAG_KAI_PARAM_LABELS[paramKey].toLowerCase()} stable`
      );
    }
  } else if (behavior.highStressDays >= 2) {
    if (paramKey === "active_acne") {
      drags.push(
        `${behavior.highStressDays} high-stress days align with acne flare risk`
      );
    }
    if (paramKey === "under_eye") {
      drags.push(
        `${behavior.highStressDays} high-stress days can deepen under-eye changes`
      );
    }
  }

  // ---- Parameter-specific nuances ----
  if (paramKey === "skin_quality" && behavior.avgWaterGlasses >= 7) {
    wins.push(
      `${behavior.avgWaterGlasses} glasses/day hydration tends to improve skin quality`
    );
  }
  if (paramKey === "hair_health" && behavior.avgSleepHours < 6) {
    drags.push("low sleep tends to slow hair-health recovery");
  }
  if (paramKey === "acne_scar" && behavior.fullRoutineDays >= 5) {
    wins.push("consistent routine is exactly what acne-scar fading needs");
  }

  const likelyDrivers: string[] = [];
  if (polarity === "improvement") {
    likelyDrivers.push(...wins, ...drags);
  } else if (polarity === "drag") {
    likelyDrivers.push(...drags, ...wins);
  } else {
    likelyDrivers.push(...wins, ...drags);
  }

  return {
    paramKey,
    paramLabel: RAG_KAI_PARAM_LABELS[paramKey],
    paramDelta,
    polarity,
    wins,
    drags,
    likelyDrivers,
  };
}

/**
 * Produce a structured weekly narrative signal pack the LLM can use
 * to write balanced causes (improvements AND regressions).
 */
export function buildNarrativeSignalPack(
  correlations: BehaviorParamCorrelation[],
  behavior: BehaviorSnapshot
) {
  const improvers = correlations
    .filter((c) => c.polarity === "improvement")
    .sort((a, b) => (b.paramDelta ?? 0) - (a.paramDelta ?? 0));
  const draggers = correlations
    .filter((c) => c.polarity === "drag")
    .sort((a, b) => (a.paramDelta ?? 0) - (b.paramDelta ?? 0));
  const stables = correlations.filter((c) => c.polarity === "stable");

  const topWins = Array.from(
    new Set(improvers.flatMap((c) => c.wins).concat(stables.flatMap((s) => s.wins)))
  ).slice(0, 4);
  const topDrags = Array.from(
    new Set(draggers.flatMap((c) => c.drags).concat(stables.flatMap((s) => s.drags)))
  ).slice(0, 4);

  const summary = {
    improvers: improvers.map((c) => ({
      label: c.paramLabel,
      delta: c.paramDelta,
      reasons: c.wins.slice(0, 2),
    })),
    draggers: draggers.map((c) => ({
      label: c.paramLabel,
      delta: c.paramDelta,
      reasons: c.drags.slice(0, 2),
    })),
    stables: stables.map((c) => ({
      label: c.paramLabel,
      delta: c.paramDelta,
    })),
    behaviorAsks: {
      routine: `${behavior.fullRoutineDays}/${behavior.windowDays} full · AM ${behavior.amRoutineDays} (${behavior.avgAmRoutineStepPct}% steps) · PM ${behavior.pmRoutineDays} (${behavior.avgPmRoutineStepPct}% steps) · blend ${behavior.routineWeightedConsistencyPct}%`,
      sleep: `${behavior.avgSleepHours}h avg`,
      water: `${behavior.avgWaterGlasses} glasses avg`,
      stress: `${behavior.avgStress}/10 avg · ${behavior.highStressDays} high-stress days`,
      sun: `${behavior.highSunDays} high-UV · ${behavior.moderateSunDays} moderate-UV days`,
      journal: `${behavior.journalEntriesCount}/${behavior.windowDays} logged (${behavior.journalCompliancePct}%)`,
    },
    topWins,
    topDrags,
  };

  return summary;
}
