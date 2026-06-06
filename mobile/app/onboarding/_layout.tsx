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
      >
        <Stack.Screen
          name="kai-intro"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#D6E4D0" } }}
        />
        <Stack.Screen
          name="capture-intro"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#D6E4D0" } }}
        />
        <Stack.Screen
          name="capture"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#F6F5F2" } }}
        />
        <Stack.Screen
          name="baseline-report"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#E8EFE6" } }}
        />
        <Stack.Screen
          name="questionnaire"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#E8EFE6" } }}
        />
      </Stack>
    </OnboardingResumeGate>
  );
}
