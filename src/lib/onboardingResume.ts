import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import {
  getOnboardingAccessForUser,
  type BaselineOnboardingJobStatus,
} from "@/src/lib/onboardingAccess";
import { isQuestionnaireMilestoneComplete } from "@/src/lib/questionnaireCompletion";

export type OnboardingResumeSnapshot = {
  /** True when baseline + questionnaire milestones are both done. */
  onboardingComplete: boolean;
  hasQuestionnaire: boolean;
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

  const [access, questionnaireMilestoneComplete] = await Promise.all([
    getOnboardingAccessForUser(userId),
    isQuestionnaireMilestoneComplete(userId),
  ]);

  const {
    baselineScanId,
    hasBaselineScan,
    baselineScanPending,
    baselineScanJobId,
    baselineScanJobStatus,
    canAccessDashboard,
  } = access;

  const baselineSubmitted = hasBaselineScan || baselineScanPending;
  const onboardingComplete =
    baselineSubmitted && questionnaireMilestoneComplete;

  let continueUrl = "/onboarding/capture/photos";
  if (!baselineSubmitted) {
    continueUrl = "/onboarding/capture/photos";
  } else if (!questionnaireMilestoneComplete) {
    continueUrl = "/onboarding/questionnaire";
  } else if (baselineScanId != null) {
    continueUrl = `/onboarding/baseline-report?scanId=${baselineScanId}`;
  } else {
    continueUrl = "/dashboard";
  }

  return {
    onboardingComplete,
    hasQuestionnaire: questionnaireMilestoneComplete,
    hasBaselineScan,
    baselineScanPending,
    baselineScanJobId,
    baselineScanJobStatus,
    baselineScanId,
    canAccessDashboard,
    continueUrl,
  };
}
