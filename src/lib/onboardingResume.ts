import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import {
  getOnboardingAccessForUser,
  userHasQuestionnaire,
} from "@/src/lib/onboardingAccess";

export type OnboardingResumeSnapshot = {
  onboardingComplete: boolean;
  hasQuestionnaire: boolean;
  hasBaselineScan: boolean;
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
      baselineScanId: null,
      canAccessDashboard: true,
      continueUrl: "/dashboard",
    };
  }

  const access = await getOnboardingAccessForUser(userId);
  const hasQuestionnaire =
    access.hasQuestionnaire ||
    userHasQuestionnaire(u.primaryConcern);
  const { baselineScanId, hasBaselineScan, canAccessDashboard } = access;

  let continueUrl = "/onboarding/capture";
  if (!hasBaselineScan) {
    continueUrl = "/onboarding/capture";
  } else if (!hasQuestionnaire) {
    continueUrl = `/onboarding/baseline-report?scanId=${baselineScanId}`;
  } else {
    continueUrl = "/onboarding/questionnaire";
  }

  return {
    onboardingComplete: false,
    hasQuestionnaire,
    hasBaselineScan,
    baselineScanId,
    canAccessDashboard,
    continueUrl,
  };
}
