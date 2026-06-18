import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import {
  getOnboardingAccessForUser,
  type BaselineOnboardingJobStatus,
} from "@/src/lib/onboardingAccess";
import { getQuestionnaireCompletionState } from "@/src/lib/questionnaireCompletion";

export type OnboardingResumeSnapshot = {
  /** True when baseline scan + questionnaire milestone (submitted) are done. */
  onboardingComplete: boolean;
  /**
   * True only when baseline + questionnaire are fully answered (no skipped steps).
   * Used to decide when onboarding routes may hard-redirect to the dashboard.
   */
  onboardingFullyComplete: boolean;
  /** Questionnaire POST saved (primary concern set). */
  hasQuestionnaire: boolean;
  /** Matches profile progress tracker questionnaire step. */
  questionnaireMilestoneComplete: boolean;
  /** Submitted with zero skipped questions — gates may close the questionnaire. */
  questionnaireFullyComplete: boolean;
  hasBaselineScan: boolean;
  /** True while baseline scan job is queued or processing (photos already submitted). */
  baselineScanPending: boolean;
  baselineScanJobId: string | null;
  baselineScanJobStatus: BaselineOnboardingJobStatus | null;
  baselineScanId: number | null;
  canAccessDashboard: boolean;
  /** Next URL to continue incomplete onboarding (web + Expo paths). */
  continueUrl: string;
};

export async function getOnboardingResumeSnapshot(
  userId: string
): Promise<OnboardingResumeSnapshot | null> {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!u) return null;

  const access = await getOnboardingAccessForUser(userId);

  const {
    baselineScanId,
    hasBaselineScan,
    hasQuestionnaire: questionnaireSubmitted,
    baselineScanPending,
    baselineScanJobId,
    baselineScanJobStatus,
    canAccessDashboard,
  } = access;

  const questionnaireState = await getQuestionnaireCompletionState(userId);
  const questionnaireMilestoneComplete = questionnaireState.submitted;
  const questionnaireFullyComplete = questionnaireState.fullyComplete;

  const baselineSubmitted = hasBaselineScan || baselineScanPending;
  const onboardingComplete =
    baselineSubmitted && questionnaireMilestoneComplete;
  const onboardingFullyComplete =
    baselineSubmitted && questionnaireFullyComplete;

  let continueUrl = "/onboarding/capture/photos";
  if (!baselineSubmitted) {
    continueUrl = "/onboarding/capture/photos";
  } else if (!questionnaireFullyComplete) {
    // Not started, or submitted with skips → keep sending the patient back to
    // the questionnaire so they can finish the remaining questions.
    continueUrl = "/onboarding/questionnaire?entry=resume";
  } else {
    continueUrl = "/dashboard";
  }

  return {
    onboardingComplete,
    onboardingFullyComplete,
    hasQuestionnaire: questionnaireSubmitted,
    questionnaireMilestoneComplete,
    questionnaireFullyComplete,
    hasBaselineScan,
    baselineScanPending,
    baselineScanJobId,
    baselineScanJobStatus,
    baselineScanId,
    canAccessDashboard,
    continueUrl,
  };
}
