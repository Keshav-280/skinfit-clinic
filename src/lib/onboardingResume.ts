import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";

import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";

export type OnboardingResumeSnapshot = {
  onboardingComplete: boolean;
  hasQuestionnaire: boolean;
  baselineScanId: number | null;
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
      baselineScanId: null,
      continueUrl: "/dashboard",
    };
  }

  const hasQuestionnaire =
    u.primaryConcern != null && String(u.primaryConcern).trim() !== "";

  let baselineScanId: number | null = null;
  if (hasQuestionnaire) {
    const [row] = await db
      .select({ id: scans.id })
      .from(scans)
      .where(
        and(
          eq(scans.userId, userId),
          eq(scans.scanName, BASELINE_ONBOARDING_SCAN_NAME)
        )
      )
      .orderBy(desc(scans.createdAt))
      .limit(1);
    baselineScanId = row?.id ?? null;
  }

  let continueUrl = "/onboarding/questionnaire";
  if (!hasQuestionnaire) {
    continueUrl = "/onboarding/questionnaire";
  } else if (baselineScanId != null) {
    continueUrl = `/onboarding/baseline-report?scanId=${baselineScanId}`;
  } else {
    continueUrl = "/onboarding/capture";
  }

  return {
    onboardingComplete: false,
    hasQuestionnaire,
    baselineScanId,
    continueUrl,
  };
}
