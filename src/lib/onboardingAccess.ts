import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";

export function userHasQuestionnaire(
  primaryConcern: string | null | undefined
): boolean {
  return primaryConcern != null && String(primaryConcern).trim() !== "";
}

export async function getUserBaselineScanId(
  userId: string
): Promise<number | null> {
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
  return row?.id ?? null;
}

export function userCanAccessDashboard(args: {
  onboardingComplete: boolean;
  hasBaselineScan: boolean;
}): boolean {
  return args.onboardingComplete || args.hasBaselineScan;
}

export async function getOnboardingAccessForUser(userId: string): Promise<{
  hasQuestionnaire: boolean;
  hasBaselineScan: boolean;
  baselineScanId: number | null;
  canAccessDashboard: boolean;
  onboardingComplete: boolean;
}> {
  const [u] = await db
    .select({
      onboardingComplete: users.onboardingComplete,
      primaryConcern: users.primaryConcern,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!u) {
    return {
      hasQuestionnaire: false,
      hasBaselineScan: false,
      baselineScanId: null,
      canAccessDashboard: false,
      onboardingComplete: false,
    };
  }

  const hasQuestionnaire = userHasQuestionnaire(u.primaryConcern);
  const baselineScanId = await getUserBaselineScanId(userId);
  const hasBaselineScan = baselineScanId != null;
  const onboardingComplete = u.onboardingComplete ?? false;

  return {
    hasQuestionnaire,
    hasBaselineScan,
    baselineScanId,
    onboardingComplete,
    canAccessDashboard: userCanAccessDashboard({
      onboardingComplete,
      hasBaselineScan,
    }),
  };
}
