export type RoutineKind = "am" | "pm";

/** In-app chat from Clinic Support (clinic chatbot). */
export function buildRoutineReminderMessage(params: {
  kind: RoutineKind;
  remainingLabels: string[];
}): string {
  const { kind, remainingLabels } = params;
  if (remainingLabels.length === 0) {
    return "";
  }
  const list = remainingLabels.join(", ");
  if (kind === "am") {
    return `SkinFit Wellness: morning routine reminder - you still have these AM steps left today: ${list}. Open your dashboard to check them off.`;
  }
  return `SkinFit Wellness: evening routine reminder - you still have these PM steps left today: ${list}. Open your dashboard to check them off.`;
}
