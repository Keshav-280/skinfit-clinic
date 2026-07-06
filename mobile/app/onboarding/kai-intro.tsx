import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { KaiMeetIntroCard } from "@/components/KaiMeetIntroCard";
import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { MEDICAL_DISCLAIMER_SHORT } from "@/lib/medicalDisclaimer";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const BOUNDARIES = [
  "No diagnosis",
  "No prescriptions",
  "Some concerns need a clinic visit",
  "Your doctor guides your care",
];

export default function KaiIntroScreen() {
  const router = useRouter();

  return (
    <OnboardingLayoutShell scanTheme={false} showHeader={false} showSignOut contentMaxWidth={896}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push("/onboarding/questionnaire?entry=start" as Href)}
          hitSlop={8}
          style={styles.skipLinkWrap}
        >
          <Text style={styles.skipLink}>Skip to questionnaire</Text>
        </Pressable>

        <KaiMeetIntroCard />

        <View style={styles.boundaryBox}>
          <View style={styles.boundaryHead}>
            <Ionicons name="shield-checkmark-outline" size={14} color={NAVY_DARK} />
            <Text style={styles.boundaryKicker}>BEFORE YOU START</Text>
          </View>
          <View style={styles.boundaryRow}>
            {BOUNDARIES.map((line) => (
              <View key={line} style={styles.boundaryPill}>
                <Text style={styles.boundaryText}>{line}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.boundaryDisclaimer}>{MEDICAL_DISCLAIMER_SHORT}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => router.push("/onboarding/capture-intro" as Href)}
        >
          <LinearGradient
            colors={[NAVY, NAVY_DARK]}
            style={styles.btnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.btnText}>Start baseline scan</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </OnboardingLayoutShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
    gap: 4,
  },
  skipLinkWrap: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  skipLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(44, 62, 107, 0.8)",
    textDecorationLine: "underline",
  },
  boundaryBox: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(44,62,107,0.1)",
    marginBottom: 16,
  },
  boundaryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
  },
  boundaryKicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: NAVY_DARK,
  },
  boundaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  boundaryPill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  boundaryText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#52525b",
  },
  boundaryDisclaimer: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: "#52525b",
    textAlign: "center",
  },
  btn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  btnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
