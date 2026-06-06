import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import {
  getOnboardingAccessForUser,
  userHasQuestionnaire,
  type BaselineOnboardingJobStatus,
} from "@/src/lib/onboardingAccess";

export type OnboardingResumeSnapshot = {
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
    .select({
      onboardingComplete: users.onboardingComplete,
      primaryConcern: users.primaryConcern,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!u) return null;

  if (u.onboardingComplete) {
    return {
      onboardingComplete: true,
      hasQuestionnaire: true,
      hasBaselineScan: true,
      baselineScanPending: false,
      baselineScanJobId: null,
      baselineScanJobStatus: null,
      baselineScanId: null,
      canAccessDashboard: true,
      continueUrl: "/dashboard",
    };
  }

  const access = await getOnboardingAccessForUser(userId);
  const hasQuestionnaire =
    access.hasQuestionnaire ||
    userHasQuestionnaire(u.primaryConcern);
  const {
    baselineScanId,
    hasBaselineScan,
    baselineScanPending,
    baselineScanJobId,
    baselineScanJobStatus,
    canAccessDashboard,
  } = access;

  const baselineSubmitted = hasBaselineScan || baselineScanPending;

  let continueUrl = "/onboarding/capture/photos";
  if (!baselineSubmitted) {
    continueUrl = "/onboarding/capture/photos";
  } else if (!hasQuestionnaire) {
    continueUrl =
      baselineScanId != null
        ? `/onboarding/baseline-report?scanId=${baselineScanId}`
        : "/onboarding/baseline-report";
  } else {
    continueUrl = "/onboarding/questionnaire";
  }

  return {
    onboardingComplete: false,
    hasQuestionnaire,
    hasBaselineScan,
    baselineScanPending,
    baselineScanJobId,
    baselineScanJobStatus,
    baselineScanId,
    canAccessDashboard,
    continueUrl,
  };
}
