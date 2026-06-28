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

export function formatAiSummary(
  text: string | null | undefined,
  metrics: DummyScanMetrics,
  scoresUnlocked: boolean
): string {
  if (!text) return "";
  let formatted = text;

  if (scoresUnlocked) {
    // 1. Replace grade -> score, grades -> scores (case-insensitive)
    formatted = formatted
      .replace(/\bgrade\b/g, "score")
      .replace(/\bGrade\b/g, "Score")
      .replace(/\bgrades\b/g, "scores")
      .replace(/\bGrades\b/g, "Scores");

    // 2. We define parameter-specific replacements to avoid replacing the letter "A" as an article.
    const paramMappings = [
      {
        keys: ["hydration", "moisture"],
        score: metrics.hydration,
      },
      {
        keys: ["texture", "skin smoothness"],
        score: metrics.texture,
      },
      {
        keys: ["pigmentation", "tone", "spots"],
        score: metrics.pigmentation,
      },
      {
        keys: ["wrinkle", "wrinkles", "fine-line", "fine line", "smoothness"],
        score: metrics.wrinkles,
      },
      {
        keys: ["acne", "blemish", "blemishes", "breakout", "breakouts", "acne clarity", "clarity"],
        score: metrics.acne,
      },
      {
        keys: ["overall", "overall health", "overall skin", "overall score"],
        score: metrics.overall_score,
      },
    ];

    for (const mapping of paramMappings) {
      const escapedKeys = mapping.keys.map((k) => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|");
      const regexStr = `\\b(${escapedKeys})\\b(?:\\s+(?:is|of|score|clarity|health|smoothness|level|levels|profile|at|rate|rated)){0,3}\\s*[:\\-—–~]?\\s*\\(?\\b([A-E])[+-]?\\b\\)?`;
      const regex = new RegExp(regexStr, "gi");

      formatted = formatted.replace(regex, (match, paramName, gradeLetter) => {
        const gradeIndex = match.lastIndexOf(gradeLetter);
        const prefix = match.substring(0, gradeIndex);
        const suffix = match.substring(gradeIndex + gradeLetter.length);
        return `${prefix}${mapping.score}${suffix}`;
      });
    }

    // 3. Fallback for any standalone grade letters:
    formatted = formatted.replace(/\b(is|of|health|score|grade|overall|at)\s+(?:an?\s+)?\b([A-E])[+-]?\b/gi, (match, prefix, gradeLetter) => {
      const gradeIndex = match.lastIndexOf(gradeLetter);
      const matchedPrefix = match.substring(0, gradeIndex);
      const suffix = match.substring(gradeIndex + gradeLetter.length);
      return `${matchedPrefix}${metrics.overall_score}${suffix}`;
    });

  } else {
    // If scoresUnlocked is false (locked), convert numbers to grades
    const paramMappings = [
      {
        keys: ["hydration", "moisture"],
        grade: patientClarityToGrade(metrics.hydration),
      },
      {
        keys: ["texture", "skin smoothness"],
        grade: patientClarityToGrade(metrics.texture),
      },
      {
        keys: ["pigmentation", "tone", "spots"],
        grade: patientClarityToGrade(metrics.pigmentation),
      },
      {
        keys: ["wrinkle", "wrinkles", "fine-line", "fine line", "smoothness"],
        grade: patientClarityToGrade(metrics.wrinkles),
      },
      {
        keys: ["acne", "blemish", "blemishes", "breakout", "breakouts", "acne clarity", "clarity"],
        grade: patientClarityToGrade(metrics.acne),
      },
      {
        keys: ["overall", "overall health", "overall skin", "overall score"],
        grade: patientClarityToGrade(metrics.overall_score),
      },
    ];

    for (const mapping of paramMappings) {
      const escapedKeys = mapping.keys.map((k) => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|");
      const regexStr = `\\b(${escapedKeys})\\b(?:\\s+(?:is|of|score|clarity|health|smoothness|level|levels|profile|at|rate|rated)){0,3}\\s*[:\\-—–~]?\\s*\\(?\\b(\\d{1,3})\\b\\)?`;
      const regex = new RegExp(regexStr, "gi");

      formatted = formatted.replace(regex, (match, paramName, numberStr) => {
        const numIndex = match.lastIndexOf(numberStr);
        const prefix = match.substring(0, numIndex);
        const suffix = match.substring(numIndex + numberStr.length);
        return `${prefix}${mapping.grade}${suffix}`;
      });
    }

    formatted = formatted.replace(/\b(is|of|health|score|grade|overall|at)\s+(?:an?\s+)?\b(\d{1,3})\b/gi, (match, prefix, numberStr) => {
      const numIndex = match.lastIndexOf(numberStr);
      const matchedPrefix = match.substring(0, numIndex);
      const suffix = match.substring(numIndex + numberStr.length);
      return `${matchedPrefix}${patientClarityToGrade(metrics.overall_score)}${suffix}`;
    });
  }

  return formatted;
}

