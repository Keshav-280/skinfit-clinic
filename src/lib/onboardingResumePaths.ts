/** Lets patients open incomplete onboarding steps from the profile progress tracker. */
export function isAllowedIncompleteOnboardingPath(
  pathname: string,
  snapshot: {
    hasBaselineScan: boolean;
    baselineScanPending: boolean;
    questionnaireMilestoneComplete: boolean;
  }
): boolean {
  const segs = pathname.split("/").filter(Boolean);
  const baselineSubmitted =
    snapshot.hasBaselineScan || snapshot.baselineScanPending;

  const onCapture = segs.some(
    (s) => s === "capture" || s === "capture-intro" || s === "photos"
  );
  const onQuestionnaire = segs.includes("questionnaire");
  const onKai = segs.includes("kai-intro");
  const onBaseline = segs.includes("baseline-report");

  if (!baselineSubmitted && onCapture) return true;
  if (
    onKai &&
    (!baselineSubmitted || !snapshot.questionnaireMilestoneComplete)
  ) {
    return true;
  }
  if (
    baselineSubmitted &&
    !snapshot.questionnaireMilestoneComplete &&
    onQuestionnaire
  ) {
    return true;
  }
  if (baselineSubmitted && onBaseline) return true;

  return false;
}
