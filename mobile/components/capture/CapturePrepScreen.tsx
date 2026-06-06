import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bottomDockInset } from "@/lib/bottomDockInset";
import { SKINFIT_GRADIENT, SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const MUTED = "#4A5568";

const WEB_PORTAL_URL =
  process.env.EXPO_PUBLIC_WEB_PORTAL_URL?.replace(/\/$/, "") ??
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "";

const TIPS = [
  { icon: "sunny-outline" as const, label: "Good natural lighting", set: "ion" as const },
  { icon: "glasses-outline" as const, label: "Remove glasses and accessories", set: "ion" as const },
  {
    icon: "face-woman-profile" as const,
    label: "Tie your hair back",
    set: "mci" as const,
  },
  { icon: "person-circle-outline" as const, label: "No makeup or heavy filters", set: "ion" as const },
  { icon: "image-outline" as const, label: "Use a plain background", set: "ion" as const },
];

type Props = {
  onStart: () => void;
  onBack?: () => void;
  showPrivacy?: boolean;
  onViewHistory?: () => void;
  /** Lift footer above the drawer bottom navigation dock. */
  reserveBottomDock?: boolean;
};

export function CapturePrepScreen({
  onStart,
  onBack,
  showPrivacy = true,
  onViewHistory,
  reserveBottomDock = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const dockInset = reserveBottomDock ? bottomDockInset() : 0;

  const openPrivacy = () => {
    if (!WEB_PORTAL_URL) return;
    void Linking.openURL(`${WEB_PORTAL_URL}/privacy`);
  };

  return (
    <LinearGradient colors={[...SKINFIT_GRADIENT.scan]} style={styles.root}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + (onBack ? 8 : 20),
            paddingBottom: Math.max(insets.bottom, 24) + dockInset,
          },
        ]}
      >
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={NAVY} />
          </Pressable>
        ) : null}

        <View style={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.title}>
              Let&apos;s capture{"\n"}your best profile
            </Text>
            <Text style={styles.subtitle}>
              We&apos;ll take 5 quick photos to create your personalized analysis.
            </Text>
          </View>

          <View style={styles.tips}>
            {TIPS.map((tip) => (
              <View key={tip.label} style={styles.tipRow}>
                <View style={styles.tipIconWrap}>
                  {tip.set === "mci" ? (
                    <MaterialCommunityIcons name={tip.icon} size={22} color={NAVY} />
                  ) : (
                    <Ionicons name={tip.icon} size={22} color={NAVY} />
                  )}
                </View>
                <Text style={styles.tipText}>{tip.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          {showPrivacy ? (
            <Pressable
              style={styles.privacyRow}
              onPress={openPrivacy}
              disabled={!WEB_PORTAL_URL}
              accessibilityRole="link"
              accessibilityLabel="Read our Privacy Policy"
            >
              <Ionicons name="lock-closed-outline" size={14} color={MUTED} style={styles.lockIcon} />
              <Text style={styles.privacyText}>
                Your photos are secure and private.{" "}
                <Text style={styles.privacyLink}>Read our Privacy Policy.</Text>
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={onStart}
          >
            <Text style={styles.btnText}>Start Scan</Text>
          </Pressable>

          {onViewHistory ? (
            <Pressable style={styles.historyLink} onPress={onViewHistory}>
              <Ionicons name="time-outline" size={18} color={NAVY} />
              <Text style={styles.historyLinkText}>View past scans</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    marginBottom: 4,
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
  },
  hero: { gap: 10 },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 24,
    color: MUTED,
    maxWidth: 310,
  },
  tips: {
    marginTop: 24,
    gap: 16,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  tipIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  tipText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: NAVY,
    lineHeight: 24,
  },
  footer: { gap: 18 },
  privacyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  lockIcon: { marginTop: 2 },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
    textAlign: "left",
  },
  privacyLink: {
    color: NAVY,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NAVY_DARK,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: NAVY_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  historyLinkText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
  },
});
