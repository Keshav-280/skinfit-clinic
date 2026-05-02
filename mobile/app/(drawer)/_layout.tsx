import { Ionicons } from "@expo/vector-icons";
import { Redirect, type Href } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

function iconForRoute(name: string, color: string, size: number) {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    index: "home",
    history: "images",
    scan: "camera",
    schedules: "calendar",
    wellness: "heart",
    chat: "chatbubbles",
    profile: "person",
  };
  const glyph = map[name] ?? "ellipse";
  return <Ionicons name={glyph} size={size} color={color} />;
}

export default function DrawerLayout() {
  const { ready, token, user } = useAuth();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  if (user?.onboardingComplete === false) {
    return <Redirect href={"/onboarding" as Href} />;
  }

  return (
    <Drawer
      screenOptions={({ route }) => ({
        drawerActiveTintColor: "#0d9488",
        drawerInactiveTintColor: "#64748b",
        headerTintColor: "#0f172a",
        headerStyle: { backgroundColor: "#ffffff" },
        sceneContainerStyle: { backgroundColor: "#fdf9f0" },
        drawerIcon: ({ color, size }) => iconForRoute(route.name, color, size),
        headerRight:
          route.name === "history" || route.name === "notifications"
            ? undefined
            : () => <NotificationBell />,
      })}
    >
      <Drawer.Screen
        name="index"
        options={{ title: "Dashboard", drawerLabel: "Dashboard" }}
      />
      <Drawer.Screen
        name="history"
        options={{
          title: "Treatment History",
          drawerLabel: "Treatment History",
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="scan"
        options={{ title: "AI Scan", drawerLabel: "AI Scan" }}
      />
      <Drawer.Screen
        name="schedules"
        options={{ title: "Schedules", drawerLabel: "Schedules" }}
      />
      <Drawer.Screen
        name="wellness"
        options={{
          title: "Overall Wellness",
          drawerLabel: "Overall Wellness",
        }}
      />
      <Drawer.Screen
        name="chat"
        options={{ title: "Chat With Us", drawerLabel: "Chat With Us" }}
      />
      <Drawer.Screen
        name="profile"
        options={{ title: "Profile", drawerLabel: "Profile" }}
      />
      <Drawer.Screen
        name="notifications"
        options={{
          title: "Notifications",
          drawerItemStyle: { display: "none" },
          drawerLabel: () => null,
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
