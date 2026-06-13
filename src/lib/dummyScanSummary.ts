/** Placeholder “AI” copy until a real model is wired. Higher metric = healthier skin. */

import { patientClarityToGrade } from "./clarityGrade";

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
  const overall = patientClarityToGrade(m.overall_score);
  const acne = patientClarityToGrade(m.acne);
  const hydration = patientClarityToGrade(m.hydration);
  const wrinkles = patientClarityToGrade(m.wrinkles);
  const texture = patientClarityToGrade(m.texture);
  const pigmentation = patientClarityToGrade(m.pigmentation);
  const templates = [
    `Today's overall skin grade is ${overall} — your hydration (${hydration}) and texture (${texture}) are helping keep things balanced; stay consistent with SPF and gentle cleansing.`,
    `We're seeing an overall grade of ${overall}. Acne clarity is ${acne} and fine-line smoothness is ${wrinkles}; a steady routine usually nudges these grades up over time.`,
    `Grade check: ${overall} overall. Pigmentation is ${pigmentation} and moisture is ${hydration} — prioritize barrier care and sun protection this week.`,
    `Your snapshot shows overall grade ${overall} with texture at ${texture} and wrinkles at ${wrinkles}. Nothing alarming for a home check-in; keep sleep and water steady.`,
    `Overall ${overall}: acne ${acne}, hydration ${hydration}. Small day-to-day swings are normal — log how your skin feels alongside these grades.`,
    `Reading of ${overall} today, with texture ${texture} and pigmentation ${pigmentation}. Consider lighter actives if anything feels tight or irritated.`,
    `Nice baseline: ${overall} overall. Hydration ${hydration} and wrinkle grade ${wrinkles} suggest your skin is responding; repeat this scan in a week to track the trend.`,
  ];
  return templates[randomInt(0, templates.length - 1)];
}
