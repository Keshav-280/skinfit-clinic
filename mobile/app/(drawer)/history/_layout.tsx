import { DrawerToggleButton } from "@react-navigation/drawer";
import { Stack } from "expo-router";

const MENU_TINT = "#18181b";

export default function HistoryStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: "#0d9488",
        headerStyle: { backgroundColor: "#ffffff" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#f8f5ef" },
        headerLeft: () => <DrawerToggleButton tintColor={MENU_TINT} />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Treatment History" }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
