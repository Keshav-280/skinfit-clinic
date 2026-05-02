/**
 * Rule-based “Feel understood” causes — journal + routine vs parameter deltas.
 * Extend with LLM later; keep deterministic and safe for v1.
 */

import type { KaiParamKey } from "@/src/lib/kaiParameters";

export type CauseBullet = { text: string; impact: "high" | "medium" | "low" };

export type KaiCausesInput = {
  /** Fraction of last 7 days with full AM+PM routine (0–1). */
  routineCompletion7d: number;
  /** Avg sleep hours last 7d (0–12). */
  avgSleep7d: number;
  /** Avg water glasses last 7d. */
  avgWaterGlasses7d: number;
  /** Delta for acne score (positive = improved). */
  acneDelta?: number | null;
  /** Delta wrinkles */
  wrinklesDelta?: number | null;
  /** High sun exposure days count last 7d */
  highSunDays?: number;
};

export function buildKaiCauses(input: KaiCausesInput): CauseBullet[] {
  const out: CauseBullet[] = [];

  if (input.routineCompletion7d >= 5 / 7 && (input.acneDelta ?? 0) > 3) {
    out.push({
      text: "Your acne score improved this week — you stayed on your AM/PM routine most days, which supports clearer skin.",
      impact: "high",
    });
  } else if (input.routineCompletion7d < 3 / 7) {
    out.push({
      text: "Routine consistency was lower this week — uneven product use can make breakouts and texture harder to predict.",
      impact: "high",
    });
  }

  if ((input.avgSleep7d ?? 0) < 6 && (input.wrinklesDelta ?? 0) < 0) {
    out.push({
      text: "Less sleep often tracks with stress hormones — that can show up as dullness or accentuated fine lines.",
      impact: "medium",
    });
  }

  if ((input.avgWaterGlasses7d ?? 0) < 4) {
    out.push({
      text: "Hydration from water was on the low side — barrier health and plumpness often respond when intake is steadier.",
      impact: "medium",
    });
  }

  if ((input.highSunDays ?? 0) >= 3 && (input.acneDelta ?? 0) < 0) {
    out.push({
      text: "Several high-sun days lined up with a tougher week for your scores — photoprotection is especially important for Indian skin tones tracking pigmentation.",
      impact: "high",
    });
  }

  if (out.length === 0) {
    out.push({
      text: "Keep logging your routine and journal — as we gather more weeks, kAI will connect your habits to your skin trends more precisely.",
      impact: "low",
    });
  }

  return out.slice(0, 4);
}

export type FocusAction = { rank: number; title: string; detail: string };

export function buildFocusActions(
  causes: CauseBullet[],
  lowParamKeys: KaiParamKey[]
): FocusAction[] {
  const actions: FocusAction[] = [];
  let r = 1;
  if (causes.some((c) => c.text.includes("routine"))) {
    actions.push({
      rank: r++,
      title: "Lock in AM/PM for 5+ days",
      detail: "Complete every step your doctor set — consistency beats intensity.",
    });
  }
  if (
    lowParamKeys.includes("hydration") ||
    lowParamKeys.includes("pigmentation")
  ) {
    actions.push({
      rank: r++,
      title: "Photoprotection + barrier",
      detail: "SPF every morning; reapply if outdoors 2+ hours in Bangalore UV.",
    });
  }
  actions.push({
    rank: r++,
    title: "Upload next weekly scan on Sunday",
    detail: "Same 5 angles, same lighting where possible — trend lines need comparable photos.",
  });
  return actions.slice(0, 3);
}
