"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { ONBOARDING_QUESTIONNAIRE_DRAFT_KEY } from "@/src/lib/onboardingQuestionnaireDraft";

type ResumeApi = {
  onboardingComplete?: boolean;
  hasQuestionnaire?: boolean;
  baselineScanId?: number | null;
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
      if (data.onboardingComplete) {
        router.replace("/dashboard");
        return;
      }

      const segs = segments(pathname);
      const isWelcome =
        segs.length === 1 && segs[0] === "onboarding";
      const isKai = segs.includes("kai-intro");
      const isQuest = segs.includes("questionnaire");
      const onEarly = isWelcome || isKai || isQuest;
      const onCapture = segs.includes("capture");
      const onBaseline = segs.includes("baseline-report");
      const hasQ = data.hasQuestionnaire === true;
      const continueUrl = data.continueUrl ?? "/onboarding/questionnaire";
      const baselineId =
        typeof data.baselineScanId === "number" ? data.baselineScanId : null;

      if (hasQ && onEarly) {
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

      if (!hasQ && onCapture) {
        router.replace("/onboarding/questionnaire");
        return;
      }

      if (!hasQ && onBaseline) {
        router.replace("/onboarding/questionnaire");
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
