/** Derived kAI onboarding lines for scan/tracker reports (from `users` questionnaire fields). */
export function deriveKaiOnboardingClinical(row: {
  concernDuration: string | null;
  skinSensitivity: string | null;
  triggers: unknown;
  baselineSleep: string | null;
}): { flags: string[]; notes: string[] } {
  const flags: string[] = [];
  const notes: string[] = [];

  if (row.concernDuration === "chronic") {
    flags.push("Chronic concern - duration over one year (clinician review).");
  }
  if (row.skinSensitivity === "high") {
    flags.push(
      "High skin sensitivity - clinician to review product prescription."
    );
  }

  const trig = Array.isArray(row.triggers)
    ? row.triggers.filter((x): x is string => typeof x === "string")
    : [];
  if (trig.includes("unsure")) {
    notes.push(
      "Triggers: patient selected “I'm not sure” - kAI will identify patterns from journal data."
    );
  }
  if (row.baselineSleep === "under5") {
    notes.push(
      "Poor sleep linked to elevated cortisol and skin inflammation (baseline questionnaire)."
    );
  }

  return { flags, notes };
}
