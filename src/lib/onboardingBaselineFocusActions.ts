import type { PatientTrackerFocusAction } from "@/src/lib/patientTrackerReport.types";

/** Instructional habits for first baseline scan - no past-behavior comparisons. */
export const ONBOARDING_BASELINE_FOCUS_ACTIONS: PatientTrackerFocusAction[] = [
  {
    rank: 1,
    title: "Follow your AM & PM routine",
    detail:
      "Log your morning and evening skincare steps in the app so kAI can learn what works for you.",
  },
  {
    rank: 2,
    title: "Drink water through the day",
    detail:
      "Steady hydration supports your skin barrier - sip water across the day when you can.",
  },
  {
    rank: 3,
    title: "Use the same scan setup next time",
    detail:
      "Soft natural light, eye-level camera, and all three angles keep your next scan easy to read.",
  },
];

export function isOnboardingBaselineFocusActions(
  actions: PatientTrackerFocusAction[]
): boolean {
  if (actions.length !== ONBOARDING_BASELINE_FOCUS_ACTIONS.length) return false;
  return actions.every(
    (a, i) =>
      a.rank === ONBOARDING_BASELINE_FOCUS_ACTIONS[i]!.rank &&
      a.title === ONBOARDING_BASELINE_FOCUS_ACTIONS[i]!.title
  );
}

export function withOnboardingBaselineFocusActions(
  report: { scanContext: { kind: string }; focusActions: PatientTrackerFocusAction[] }
): { focusActions: PatientTrackerFocusAction[]; patched: boolean } {
  if (report.scanContext.kind !== "onboarding_first_scan") {
    return { focusActions: report.focusActions, patched: false };
  }
  if (isOnboardingBaselineFocusActions(report.focusActions)) {
    return { focusActions: report.focusActions, patched: false };
  }
  return { focusActions: ONBOARDING_BASELINE_FOCUS_ACTIONS, patched: true };
}
