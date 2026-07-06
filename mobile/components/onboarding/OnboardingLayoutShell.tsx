import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { SKINFIT_GRADIENT, SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;

type Props = {
  children: ReactNode;
  title?: string;
  backHref?: Href;
  scanTheme?: boolean;
  showHeader?: boolean;
  /** Fixed top-right icon sign-out for patient onboarding routes. */
  showSignOut?: boolean;
  /** Max content width for patient onboarding screens (default 480). */
  contentMaxWidth?: number;
};

function OnboardingSignOutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/login" as Href);
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.signOutFixed, { paddingTop: Math.max(insets.top, 8) + 4 }]}
    >
      <Pressable
        onPress={() => void handleSignOut()}
        style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
        hitSlop={8}
        accessibilityLabel="Sign out"
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={18} color={NAVY} />
      </Pressable>
    </View>
  );
}

export function OnboardingLayoutShell({
  children,
  title = "kAI baseline scan",
  backHref = "/onboarding/kai-intro" as Href,
  scanTheme = true,
  showHeader = true,
  showSignOut = false,
  contentMaxWidth = 480,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!scanTheme) {
    return (
      <LinearGradient
        colors={[...SKINFIT_GRADIENT.patient]}
        style={styles.flex}
      >
        {showSignOut ? <OnboardingSignOutButton /> : null}
        {showHeader ? (
          <View style={[styles.plainHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.push(backHref)} hitSlop={10}>
              <Text style={styles.plainBack}>SkinFit — kAI setup</Text>
            </Pressable>
          </View>
        ) : null}
        <View
          style={[
            styles.plainMain,
            { maxWidth: contentMaxWidth },
            !showHeader && {
              paddingTop: insets.top + 20,
            },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[...SKINFIT_GRADIENT.scan]}
      style={styles.flex}
    >
      {showHeader ? (
        <View style={[styles.scanHeader, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.push(backHref)}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={18} color={NAVY} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          <View style={styles.titleRow}>
            <View style={styles.sparkleCircle}>
              <Ionicons name="sparkles" size={16} color="#fff" />
            </View>
            <Text style={styles.scanTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      ) : null}
      <View
        style={[
          styles.scanMain,
          !showHeader && { paddingTop: insets.top + 20 },
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  signOutFixed: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 50,
    paddingRight: 12,
  },
  signOutBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  signOutBtnPressed: {
    opacity: 0.65,
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    backgroundColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  sparkleCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 72 },
  scanMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  plainHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.4)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  plainBack: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },
  plainMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
});
