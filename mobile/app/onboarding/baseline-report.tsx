import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";
import { useAuth } from "@/contexts/AuthContext";

const NAVY = "#2C3E6B";

export default function BaselineReportScreen() {
  const { scanId: scanIdParam } = useLocalSearchParams<{ scanId?: string }>();
  const scanId =
    typeof scanIdParam === "string"
      ? scanIdParam
      : Array.isArray(scanIdParam)
        ? scanIdParam[0]
        : undefined;
  const router = useRouter();
  const { token, refreshUserFromProfile } = useAuth();

  async function goDashboard() {
    if (token) await refreshUserFromProfile(token);
    router.replace("/(drawer)" as Href);
  }

  return (
    <OnboardingLayoutShell title="kAI baseline scan">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={36} color="#fff" />
          </View>

          <Text style={styles.kicker}>Baseline</Text>
          <Text style={styles.title}>Baseline captured</Text>
          <Text style={styles.body}>
            Your kAI baseline scan is saved. You can open the full report from Treatment
            History anytime. Answer a few questions when you&apos;re ready — or explore the
            dashboard first.
          </Text>

          <View style={styles.sparkleRow}>
            <Ionicons name="sparkles" size={14} color={NAVY} />
            <Text style={styles.sparkleText}>
              Report builds in the background — no need to wait here.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={() => router.push("/onboarding/questionnaire" as Href)}
          >
            <Text style={styles.btnText}>Continue to answer questions</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnOutline, pressed && styles.btnOutlinePressed]}
            onPress={() => void goDashboard()}
          >
            <Text style={styles.btnOutlineText}>Go to dashboard</Text>
          </Pressable>
          {scanId ? (
            <Pressable
              style={styles.linkBtn}
              onPress={() =>
                router.replace(`/(drawer)/history/${scanId}` as Href)
              }
            >
              <Text style={styles.link}>View report now</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </OnboardingLayoutShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 16,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.35)",
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(44,62,107,0.7)",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
    textAlign: "center",
  },
  sparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  sparkleText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  btn: {
    marginTop: 4,
    width: "100%",
    backgroundColor: NAVY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnPressed: { opacity: 0.92 },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnOutline: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.5)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOutlinePressed: { opacity: 0.9 },
  btnOutlineText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
  },
  linkBtn: { marginTop: 4 },
  link: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },
});
