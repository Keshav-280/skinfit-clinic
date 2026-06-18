import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getOnboardingResumeSnapshot } from "@/src/lib/onboardingResume";

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const snap = await getOnboardingResumeSnapshot(userId);
  if (!snap) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    onboardingComplete: snap.onboardingComplete,
    onboardingFullyComplete: snap.onboardingFullyComplete,
    hasQuestionnaire: snap.hasQuestionnaire,
    questionnaireMilestoneComplete: snap.questionnaireMilestoneComplete,
    questionnaireFullyComplete: snap.questionnaireFullyComplete,
    hasBaselineScan: snap.hasBaselineScan,
    baselineScanPending: snap.baselineScanPending,
    baselineScanJobId: snap.baselineScanJobId,
    baselineScanJobStatus: snap.baselineScanJobStatus,
    baselineScanId: snap.baselineScanId,
    canAccessDashboard: snap.canAccessDashboard,
    continueUrl: snap.continueUrl,
  });
}
