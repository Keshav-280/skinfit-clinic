import { Ionicons } from "@expo/vector-icons";
import { Redirect, type Href, usePathname, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";

import { NotificationBell } from "@/components/NotificationBell";
import { ScanJobReadyNotifier } from "@/components/ScanJobReadyNotifier";
import { useAuth } from "@/contexts/AuthContext";
import { getOnboardingDashboardSkip } from "@/lib/onboardingDashboardSkip";

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
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  match: string[];
}> = [
  { key: "scan", href: "/scan" as Href, icon: "camera-outline", activeIcon: "camera", label: "Diagnose", match: ["/scan"] },
  { key: "home", href: "/(drawer)" as Href, icon: "home-outline", activeIcon: "home", label: "Build", match: ["/", "/index"] },
  { key: "schedules", href: "/schedules" as Href, icon: "heart-outline", activeIcon: "heart", label: "Maintain", match: ["/schedules"] },
  { key: "chat", href: "/chat" as Href, icon: "chatbubbles-outline", activeIcon: "chatbubbles", label: "Chat", match: ["/chat"] },
  { key: "profile", href: "/profile" as Href, icon: "person-outline", activeIcon: "person", label: "Profile", match: ["/profile"] },
];

function routeIsActive(pathname: string, item: (typeof DOCK_ITEMS)[number]) {
  return item.match.some((entry) => pathname === entry || pathname.startsWith(`${entry}/`));
}

function BottomTabBar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {DOCK_ITEMS.map((item) => {
        const active = routeIsActive(pathname, item);
        return (
          <Pressable
            key={item.key}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
            onPress={() => router.replace(item.href)}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
          >
            <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={22}
                color={active ? "#1E1B31" : "#9CA3AF"}
              />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DrawerLayout() {
  const { ready, token, user } = useAuth();
  const pathname = usePathname();
  // Explicit "Skip to dashboard" during onboarding — web allows the dashboard
  // without a baseline scan, so mobile honors the same choice.
  const [skippedOnboarding, setSkippedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setSkippedOnboarding(false);
      return;
    }
    void getOnboardingDashboardSkip(user.id).then((v) => {
      if (alive) setSkippedOnboarding(v);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!ready || skippedOnboarding == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  const canAccess =
    skippedOnboarding ||
    (user?.canAccessDashboard ??
      user?.baselineScanPending ??
      user?.hasBaselineScan ??
      user?.onboardingComplete !== false);
  if (!canAccess) {
    return <Redirect href={"/onboarding/kai-intro" as Href} />;
  }

  return (
    <View style={styles.root}>
      <Drawer
        initialRouteName="index"
        screenOptions={({ route }) => ({
          drawerActiveTintColor: "#1E1B31",
          drawerInactiveTintColor: "#64748b",
          headerTintColor: "#1E1B31",
          headerStyle: { backgroundColor: "#FAF8F5" },
          headerTitleStyle: { fontWeight: "700", color: "#1E1B31" },
          headerShadowVisible: false,
          // Drawer navigator only skips its toggle when headerLeft is null/undefined — not when
          // a component returns null. With drawer width 0, the default toggle clips off-screen.
          headerLeft: () => <View />,
          swipeEnabled: false,
          drawerType: "front",
          drawerStyle: {
            width: 0,
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
            backgroundColor: "#FAF8F5",
            paddingBottom: keyboardVisible ? 0 : 88,
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
          options={{ title: "Build", drawerLabel: "Build", headerShown: false }}
        />
        <Drawer.Screen
          name="scan"
          options={{
            title: "Diagnose",
            drawerLabel: "Diagnose",
            headerShown: false,
            lazy: false,
          }}
        />
        <Drawer.Screen
          name="schedules"
          options={{
            title: "Maintain",
            drawerLabel: "Maintain",
            headerShown: false,
          }}
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
          options={{
            title: "Profile",
            drawerLabel: "Profile",
            headerStyle: { backgroundColor: "#FAF8F5" },
          }}
        />
        <Drawer.Screen
          name="edit-profile"
          options={{
            title: "Edit Profile",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="notifications"
          options={{
            title: "Notifications",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="upcoming-appointments"
          options={{
            title: "Appointments",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="sleep-tracker"
          options={{
            title: "Sleep",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="hydration-tracker"
          options={{
            title: "Hydration",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="stress-tracker"
          options={{
            title: "Stress",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="all-skin-params"
          options={{
            title: "All Skin Parameters",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="morning-routine"
          options={{
            title: "Morning Routine",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
        <Drawer.Screen
          name="night-routine"
          options={{
            title: "Night Routine",
            headerShown: false,
            drawerItemStyle: { display: "none" },
            drawerLabel: () => null,
          }}
        />
      </Drawer>
      <ScanJobReadyNotifier />
      {!keyboardVisible && <BottomTabBar pathname={pathname} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  tabItemPressed: {
    opacity: 0.65,
  },
  tabIconWrap: {
    width: 40,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(30, 27, 49, 0.1)",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9CA3AF",
    marginBottom: 2,
  },
  tabLabelActive: {
    color: "#1E1B31",
    fontWeight: "600",
  },
});
