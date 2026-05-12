import { Stack } from "expo-router";

const BG = "#E8EFE6";
const NAVY = "#2C3E6B";

export default function HistoryStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: NAVY,
        headerStyle: { backgroundColor: BG },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: BG },
        headerLeft: () => null,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="visits" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="visit/[visitId]" options={{ headerShown: false }} />
    </Stack>
  );
}
