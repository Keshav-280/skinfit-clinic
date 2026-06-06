import { useRouter, type Href } from "expo-router";

import { CapturePrepScreen } from "@/components/capture/CapturePrepScreen";

export default function OnboardingCaptureIntroScreen() {
  const router = useRouter();

  return (
    <CapturePrepScreen
      onStart={() => router.push("/onboarding/capture" as Href)}
      showPrivacy
    />
  );
}
