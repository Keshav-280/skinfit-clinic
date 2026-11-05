"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { isAllowedIncompleteOnboardingPath } from "@/src/lib/onboardingResumePaths";
import { ONBOARDING_QUESTIONNAIRE_DRAFT_KEY } from "@/src/lib/onboardingQuestionnaireDraft";

type ResumeApi = {
  onboardingComplete?: boolean;
  hasQuestionnaire?: boolean;
  questionnaireMilestoneComplete?: boolean;
  questionnaireFullyComplete?: boolean;
  hasBaselineScan?: boolean;
  baselineScanPending?: boolean;
  baselineScanId?: number | null;
  canAccessDashboard?: boolean;
  continueUrl?: string;
};

function segments(pathname: string) {
  return pathname.split("/").filter(Boolean);
}

function normPath(p: string) {
  const t = p.replace(/\/$/, "");
  return t === "" ? "/" : t;
}

function onboardingTargetMatches(
  pathname: string,
  searchParams: URLSearchParams,
  continueUrl: string
): boolean {
  const [targetPath, targetQs] = continueUrl.split("?");
  if (normPath(pathname) !== normPath(targetPath)) return false;
  const want = new URLSearchParams(targetQs ?? "");
  for (const [k, v] of want) {
    if (searchParams.get(k) !== v) return false;
  }
  return true;
}

function isCaptureFlow(segs: string[]): boolean {
  return segs.some((s) => s === "capture" || s === "capture-intro");
}

export function OnboardingResumeGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/onboarding/resume", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as ResumeApi;
      const continueUrl = data.continueUrl ?? "/onboarding/capture/photos";

      const segs = segments(pathname);
      const isWelcome = segs.length === 1 && segs[0] === "onboarding";
      const isKai = segs.includes("kai-intro");
      const isQuest = segs.includes("questionnaire");
      const onBaseline = segs.includes("baseline-report");
      const onCaptureFlow = isCaptureFlow(segs);
      const hasQ = data.hasQuestionnaire === true;
      const hasBaseline = data.hasBaselineScan === true;
      const baselinePending = data.baselineScanPending === true;
      const baselineSubmitted = hasBaseline || baselinePending;
      const questionnaireMilestoneComplete =
        data.questionnaireMilestoneComplete === true;
      // Legacy servers without the field: fall back to submitted.
      const questionnaireFullyComplete =
        data.questionnaireFullyComplete ?? questionnaireMilestoneComplete;
      const baselineId =
        typeof data.baselineScanId === "number" ? data.baselineScanId : null;

      if (
        isAllowedIncompleteOnboardingPath(pathname, {
          hasBaselineScan: hasBaseline,
          baselineScanPending: baselinePending,
          // Submitted-with-skips keeps the questionnaire reachable from the
          // profile tracker so skipped questions can still be answered.
          questionnaireMilestoneComplete: questionnaireFullyComplete,
        })
      ) {
        if (
          onBaseline &&
          baselineId != null &&
          searchParams.get("scanId") !== String(baselineId)
        ) {
          router.replace(`/onboarding/baseline-report?scanId=${baselineId}`);
        }
        return;
      }

      if (onboardingTargetMatches(pathname, searchParams, continueUrl)) {
        if (
          onBaseline &&
          baselineId != null &&
          searchParams.get("scanId") !== String(baselineId)
        ) {
          router.replace(`/onboarding/baseline-report?scanId=${baselineId}`);
        }
        return;
      }

      if (continueUrl === "/dashboard") {
        router.replace("/dashboard");
        return;
      }

      // Scan first, questionnaire second. Once a baseline scan exists, send the patient to the
      // baseline page, which ASKS whether they want to fill the questionnaire now. Never push them
      // straight into it.
      const afterScanUrl =
        baselineId != null
          ? `/onboarding/baseline-report?scanId=${baselineId}`
          : "/onboarding/baseline-report";

      if (baselineSubmitted && onCaptureFlow) {
        // Scan still processing (no id yet): stay on the capture/progress screen.
        if (baselineId != null) router.replace(afterScanUrl);
        return;
      }

      if (baselineSubmitted && !hasQ && (isWelcome || isKai)) {
        router.replace(afterScanUrl);
        return;
      }

      if (
        hasQ &&
        questionnaireMilestoneComplete &&
        (isWelcome || isKai || (isQuest && questionnaireFullyComplete))
      ) {
        if (!onboardingTargetMatches(pathname, searchParams, continueUrl)) {
          if (isQuest) {
            try {
              localStorage.removeItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
            } catch {
              /* */
            }
          }
          router.replace(continueUrl);
        }
        return;
      }

      if (
        onBaseline &&
        baselineId != null &&
        searchParams.get("scanId") !== String(baselineId)
      ) {
        router.replace(`/onboarding/baseline-report?scanId=${baselineId}`);
      }
    };

    void run();
  }, [pathname, router, searchParams]);

  return <>{children}</>;
}
