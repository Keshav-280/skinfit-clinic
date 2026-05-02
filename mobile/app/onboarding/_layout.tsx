import { Stack } from "expo-router";

import { OnboardingResumeGate } from "@/components/OnboardingResumeGate";

export default function OnboardingLayout() {
  return (
    <OnboardingResumeGate>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#0f172a",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#fdf9f0" },
        }}
      />
    </OnboardingResumeGate>
  );
}
