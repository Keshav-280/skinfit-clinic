import {
  useLocalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import { type ReactNode, useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { ONBOARDING_QUESTIONNAIRE_DRAFT_KEY } from "@/lib/onboardingQuestionnaireDraft";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

function targetMatchesPathAndScan(
  pathname: string,
  scanIdParam: string | undefined,
  continueUrl: string
): boolean {
  const [targetPath, targetQs] = continueUrl.split("?");
  if (normPath(pathname) !== normPath(targetPath)) return false;
  const want = new URLSearchParams(targetQs ?? "");
  const needScan = want.get("scanId");
  if (needScan == null) return true;
  return scanIdParam === needScan;
}

export function OnboardingResumeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const params = useLocalSearchParams<{ scanId?: string | string[] }>();
  const router = useRouter();
  const { token, ready } = useAuth();

  const scanIdParam = Array.isArray(params.scanId)
    ? params.scanId[0]
    : params.scanId;

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<ResumeApi>("/api/onboarding/resume", token, {
          method: "GET",
        });
        if (cancelled) return;
        if (data.onboardingComplete) {
          router.replace("/(drawer)" as never);
          return;
        }

        const segs = segments(pathname);
        const isWelcome = segs.length === 1 && segs[0] === "onboarding";
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
          if (!targetMatchesPathAndScan(pathname, scanIdParam, continueUrl)) {
            if (isQuest) {
              void AsyncStorage.removeItem(ONBOARDING_QUESTIONNAIRE_DRAFT_KEY);
            }
            router.replace(continueUrl as never);
          }
          return;
        }

        if (!hasQ && onCapture) {
          router.replace("/onboarding/questionnaire" as never);
          return;
        }

        if (!hasQ && onBaseline) {
          router.replace("/onboarding/questionnaire" as never);
          return;
        }

        if (
          onBaseline &&
          baselineId != null &&
          scanIdParam !== String(baselineId)
        ) {
          router.replace(
            `/onboarding/baseline-report?scanId=${baselineId}` as never
          );
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, pathname, router, scanIdParam]);

  return <>{children}</>;
}
