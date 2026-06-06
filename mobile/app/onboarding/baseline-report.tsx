import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { CaptureDoneScreen } from "@/components/capture/CaptureDoneScreen";
import { useAuth } from "@/contexts/AuthContext";

export default function BaselineReportScreen() {
  const { scanId: scanIdParam, pending: pendingParam } = useLocalSearchParams<{
    scanId?: string;
    pending?: string;
  }>();
  const scanId =
    typeof scanIdParam === "string"
      ? scanIdParam
      : Array.isArray(scanIdParam)
        ? scanIdParam[0]
        : undefined;
  const reportPending =
    pendingParam === "1" ||
    pendingParam === "true" ||
    (scanId == null && pendingParam !== "0" && pendingParam !== "false");
  const router = useRouter();
  const { token, refreshUserFromProfile } = useAuth();

  async function goDashboard() {
    if (token) {
      try {
        await refreshUserFromProfile(token);
      } catch {
        /* session updated when photos were submitted */
      }
    }
    router.replace("/(drawer)" as Href);
  }

  return (
    <CaptureDoneScreen
      mode="onboarding"
      reportPending={reportPending}
      onPrimary={() => router.push("/onboarding/questionnaire" as Href)}
      onDashboard={() => void goDashboard()}
    />
  );
}
