import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";

const NAVY = "#2C3E6B";
const N = FACE_SCAN_CAPTURE_STEPS.length;

const STEP_ICONS: Record<
  (typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"],
  keyof typeof Ionicons.glyphMap
> = {
  centre: "person-outline",
  left: "arrow-back-outline",
  right: "arrow-forward-outline",
  eyes_closed: "eye-off-outline",
  smiling: "happy-outline",
};

const STEP_LABEL: Record<(typeof FACE_SCAN_CAPTURE_STEPS)[number]["id"], string> = {
  centre: "Front",
  left: "Turn L",
  right: "Turn R",
  eyes_closed: "Eyes shut",
  smiling: "Smile",
};

export default function OnboardingCaptureIntroScreen() {
  const router = useRouter();

  return (
    <OnboardingLayoutShell title="kAI baseline photos" backHref="/onboarding/kai-intro">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="camera" size={32} color="#fff" />
        </View>
        <Text style={styles.kicker}>Baseline</Text>
        <Text style={styles.title}>{N} baseline photos</Text>
        <Text style={styles.sub}>
          ~2 minutes · we prompt each angle. Camera or upload — same flow as Scan.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>Angles in order</Text>
          <View style={styles.grid}>
            {FACE_SCAN_CAPTURE_STEPS.map((s, i) => (
              <View key={s.id} style={styles.gridItem}>
                <View style={styles.numBadge}>
                  <Text style={styles.numText}>{i + 1}</Text>
                </View>
                <Ionicons
                  name={STEP_ICONS[s.id]}
                  size={22}
                  color={NAVY}
                  style={{ marginTop: 8 }}
                />
                <Text style={styles.gridLabel}>{STEP_LABEL[s.id]}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => router.push("/onboarding/capture" as Href)}
        >
          <Text style={styles.btnText}>Start capture</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </ScrollView>
    </OnboardingLayoutShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
    alignItems: "center",
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(44,62,107,0.7)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 320,
    paddingHorizontal: 8,
  },
  card: {
    marginTop: 24,
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.35)",
    padding: 16,
  },
  cardKicker: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(44,62,107,0.6)",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  gridItem: {
    width: "19%",
    maxWidth: 72,
    flexGrow: 1,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.5)",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  numBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  gridLabel: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    color: "#374151",
  },
  btn: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    maxWidth: 360,
    backgroundColor: NAVY,
    paddingVertical: 16,
    borderRadius: 14,
  },
  btnPressed: { opacity: 0.9 },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
