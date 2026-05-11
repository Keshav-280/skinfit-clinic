import { Stack } from "expo-router";

export default function HistoryStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: "#0d9488",
        headerStyle: { backgroundColor: "#ffffff" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#f8f5ef" },
        headerLeft: () => null,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Treatment History" }} />
      <Stack.Screen name="visits" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="visit/[visitId]" options={{ headerShown: false }} />
    </Stack>
  );
}
