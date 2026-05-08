import { Ionicons } from "@expo/vector-icons";
import { Redirect, type Href, usePathname, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";

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

const DOCK_ITEMS: Array<{
  key: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  match: string[];
}> = [
  { key: "home", href: "/(drawer)", icon: "home-outline", match: ["/", "/index"] },
  { key: "schedules", href: "/(drawer)/schedules", icon: "calendar-outline", match: ["/schedules"] },
  { key: "scan", href: "/(drawer)/scan", icon: "camera-outline", match: ["/scan"] },
  { key: "chat", href: "/(drawer)/chat", icon: "chatbubbles", match: ["/chat"] },
  { key: "profile", href: "/(drawer)/profile", icon: "person-circle-outline", match: ["/profile"] },
];

function routeIsActive(pathname: string, item: (typeof DOCK_ITEMS)[number]) {
  return item.match.some((entry) => pathname === entry || pathname.startsWith(`${entry}/`));
}

function GlobalGlassDock({ pathname, onHide }: { pathname: string; onHide: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dockWrap, { bottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.dockBar}>
        <Pressable style={styles.dockHideBtn} onPress={onHide} hitSlop={10}>
          <Ionicons name="chevron-down" size={14} color="#6b7280" />
        </Pressable>
        {DOCK_ITEMS.map((item) => {
          const active = routeIsActive(pathname, item);
          return (
            <Pressable
              key={item.key}
              style={styles.dockButton}
              onPress={() => router.push(item.href)}
              hitSlop={8}
            >
              <Ionicons name={item.icon} size={24} color={active ? "#23286f" : "#ffffff"} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DockRestoreButton({ onShow }: { onShow: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.restoreWrap, { bottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <Pressable style={styles.restoreBtn} onPress={onShow} hitSlop={10}>
        <Ionicons name="chevron-up" size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}

export default function DrawerLayout() {
  const { ready, token, user } = useAuth();
  const pathname = usePathname();
  const showGlobalDock = true;
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const dockVisible = showGlobalDock && !dockCollapsed && !keyboardVisible;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
    <View style={styles.root}>
      <Drawer
        screenOptions={({ route }) => ({
          drawerActiveTintColor: "#0d9488",
          drawerInactiveTintColor: "#64748b",
          headerTintColor: "#0f172a",
          headerStyle: { backgroundColor: "#ffffff" },
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          headerLeft: () => null,
          swipeEnabled: false,
          drawerStyle: {
            backgroundColor: "#ffffff",
            width: 286,
            borderTopRightRadius: 20,
            borderBottomRightRadius: 20,
          },
          drawerItemStyle: {
            borderRadius: 12,
            marginHorizontal: 10,
            marginVertical: 3,
            paddingHorizontal: 6,
          },
          drawerLabelStyle: {
            fontSize: 14,
            fontWeight: "600",
          },
          sceneContainerStyle: {
            backgroundColor: "#dfe7dc",
            paddingBottom: dockVisible ? 100 : 0,
          },
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
          options={{
            title: "Chat With Us",
            drawerLabel: "Chat With Us",
            headerShown: false,
          }}
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
      {dockVisible ? (
        <GlobalGlassDock pathname={pathname} onHide={() => setDockCollapsed(true)} />
      ) : showGlobalDock && !keyboardVisible ? (
        <DockRestoreButton onShow={() => setDockCollapsed(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  dockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dockBar: {
    width: "86%",
    borderRadius: 32,
    backgroundColor: "rgba(167, 167, 167, 0.42)",
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  dockHideBtn: {
    position: "absolute",
    top: -12,
    right: 14,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d1d5db",
    zIndex: 2,
  },
  dockButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreWrap: {
    position: "absolute",
    right: 16,
  },
  restoreBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(35, 40, 111, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 6,
  },
});
