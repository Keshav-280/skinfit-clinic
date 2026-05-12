import { Stack } from "expo-router";

import { OnboardingResumeGate } from "@/components/OnboardingResumeGate";

export default function OnboardingLayout() {
  return (
    <OnboardingResumeGate>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#E8EFE6" },
          headerTintColor: "#2C3E6B",
          headerTitleStyle: { fontWeight: "700", color: "#2C3E6B" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#E8EFE6" },
        }}
      />
    </OnboardingResumeGate>
  );
}
