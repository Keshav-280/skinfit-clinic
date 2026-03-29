/** Placeholder “AI” copy until a real model is wired. Higher metric = healthier skin. */

export type DummyScanMetrics = {
  acne: number;
  pigmentation: number;
  wrinkles: number;
  hydration: number;
  texture: number;
  overall_score: number;
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function buildDummyAiSummary(m: DummyScanMetrics): string {
  const { overall_score: o, acne: a, hydration: h, wrinkles: w, texture: t } = m;
  const templates = [
    `Today’s overall skin score is ${o}/100 — your hydration (${h}) and texture (${t}) are helping keep things balanced; stay consistent with SPF and gentle cleansing.`,
    `We’re seeing a ${o}/100 overall reading. Acne clarity sits at ${a} and fine-line smoothness at ${w}; a steady routine usually nudges these numbers up over time.`,
    `Score check: ${o}/100 overall. Pigmentation is at ${m.pigmentation} and moisture at ${h} — prioritize barrier care and sun protection this week.`,
    `Your snapshot shows ${o}/100 overall with texture at ${t} and wrinkles at ${w}. Nothing alarming for a home check-in; keep sleep and water steady.`,
    `Overall ${o}/100: acne ${a}, hydration ${h}. Small day-to-day swings are normal — log how your skin feels alongside these numbers.`,
    `Reading of ${o}/100 today, with texture ${t} and pigmentation ${m.pigmentation}. Consider lighter actives if anything feels tight or irritated.`,
    `Nice baseline: ${o}/100 overall. Hydration ${h} and wrinkle score ${w} suggest your skin is responding; repeat this scan in a week to track the trend.`,
  ];
  return templates[randomInt(0, templates.length - 1)];
}
