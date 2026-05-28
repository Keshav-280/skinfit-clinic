/** kAI questionnaire red flags persisted on `users` after onboarding. */
export function patientHasOnboardingClinicalAlert(row: {
  concernDuration: string | null;
  skinSensitivity: string | null;
}): boolean {
  return (
    row.concernDuration === "chronic" || row.skinSensitivity === "high"
  );
}

export function onboardingClinicalAlertSummary(row: {
  concernDuration: string | null;
  skinSensitivity: string | null;
}): string | null {
  const parts: string[] = [];
  if (row.concernDuration === "chronic") parts.push("Chronic concern");
  if (row.skinSensitivity === "high") parts.push("High sensitivity");
  return parts.length > 0 ? parts.join(" · ") : null;
}
