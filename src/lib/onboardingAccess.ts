import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { scanJobs, scans, users } from "@/src/db/schema";
import { BASELINE_ONBOARDING_SCAN_NAME } from "@/src/lib/onboardingConstants";

export type BaselineOnboardingJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type BaselineOnboardingJobSnapshot = {
  jobId: string;
  status: BaselineOnboardingJobStatus;
  resultScanId: number | null;
};

export async function getLatestBaselineOnboardingJob(
  userId: string
): Promise<BaselineOnboardingJobSnapshot | null> {
  const [row] = await db
    .select({
      jobId: scanJobs.id,
      status: scanJobs.status,
      resultScanId: scanJobs.resultScanId,
    })
    .from(scanJobs)
    .where(
      and(
        eq(scanJobs.userId, userId),
        sql`${scanJobs.payloadJson}->>'scanName' = ${BASELINE_ONBOARDING_SCAN_NAME}`
      )
    )
    .orderBy(desc(scanJobs.createdAt))
    .limit(1);

  if (!row) return null;
  return {
    jobId: row.jobId,
    status: row.status,
    resultScanId: row.resultScanId,
  };
}

/** Baseline photos submitted and still in the async scan queue or worker. */
export function isBaselineScanJobInProgress(
  job: BaselineOnboardingJobSnapshot | null
): boolean {
  return job != null && (job.status === "pending" || job.status === "processing");
}

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
  baselineScanPending?: boolean;
}): boolean {
  return (
    args.onboardingComplete ||
    args.hasBaselineScan ||
    args.baselineScanPending === true
  );
}

export async function getOnboardingAccessForUser(userId: string): Promise<{
  hasQuestionnaire: boolean;
  hasBaselineScan: boolean;
  baselineScanId: number | null;
  baselineScanPending: boolean;
  baselineScanJobId: string | null;
  baselineScanJobStatus: BaselineOnboardingJobStatus | null;
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
      baselineScanPending: false,
      baselineScanJobId: null,
      baselineScanJobStatus: null,
      canAccessDashboard: false,
      onboardingComplete: false,
    };
  }

  const hasQuestionnaire = userHasQuestionnaire(u.primaryConcern);
  const baselineJob = await getLatestBaselineOnboardingJob(userId);
  const scanIdFromDb = await getUserBaselineScanId(userId);
  const scanIdFromJob =
    baselineJob?.status === "completed" && baselineJob.resultScanId != null
      ? baselineJob.resultScanId
      : null;
  const baselineScanId = scanIdFromDb ?? scanIdFromJob;
  const hasBaselineScan = baselineScanId != null;
  const baselineScanPending = isBaselineScanJobInProgress(baselineJob);
  const onboardingComplete = u.onboardingComplete ?? false;

  return {
    hasQuestionnaire,
    hasBaselineScan,
    baselineScanId,
    baselineScanPending,
    baselineScanJobId: baselineJob?.jobId ?? null,
    baselineScanJobStatus: baselineJob?.status ?? null,
    onboardingComplete,
    canAccessDashboard: userCanAccessDashboard({
      onboardingComplete,
      hasBaselineScan,
      baselineScanPending,
    }),
  };
}
