import { Stack } from "expo-router";

const BG = "#F0EAE2";
const NAVY = "#1E1B31";

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
