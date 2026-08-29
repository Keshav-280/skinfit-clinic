import { Stack } from "expo-router";

import { OnboardingResumeGate } from "@/components/OnboardingResumeGate";

export default function OnboardingLayout() {
  return (
    <OnboardingResumeGate>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#F0EAE2" },
          headerTintColor: "#1E1B31",
          headerTitleStyle: { fontWeight: "700", color: "#1E1B31" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#F0EAE2" },
        }}
      >
        <Stack.Screen
          name="kai-intro"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#DCCFC0" } }}
        />
        <Stack.Screen
          name="capture-intro"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#DCCFC0" } }}
        />
        <Stack.Screen
          name="capture"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#F6F5F2" } }}
        />
        <Stack.Screen
          name="baseline-report"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#F0EAE2" } }}
        />
        <Stack.Screen
          name="questionnaire"
          options={{ headerShown: false, contentStyle: { backgroundColor: "#F0EAE2" } }}
        />
      </Stack>
    </OnboardingResumeGate>
  );
}
