import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";

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
    <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.wrap}>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={44} color={NAVY} />
          </View>
        </View>
        <Text style={styles.title}>Baseline captured</Text>
        <Text style={styles.body}>
          Your kAI baseline scan is saved. Answer a few questions when you&apos;re ready, or
          explore the dashboard first.
        </Text>
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
        <Pressable
          style={styles.linkBtn}
          onPress={() =>
            router.replace(`/(drawer)/history/${scanId ?? ""}` as Href)
          }
          disabled={!scanId}
        >
          <Text style={styles.link}>View report now</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, padding: 24, justifyContent: "center" },
  iconWrap: { alignItems: "center", marginBottom: 20 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A2E",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 23,
    color: "#52525b",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  btn: {
    marginTop: 28,
    backgroundColor: NAVY,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
  },
  btnPressed: { backgroundColor: NAVY_DARK, transform: [{ scale: 0.98 }] },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  btnOutline: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: NAVY,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  btnOutlinePressed: { backgroundColor: "#E2E8F0" },
  btnOutlineText: { color: NAVY, fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 18, alignItems: "center" },
  link: { color: NAVY, fontWeight: "700", fontSize: 15 },
});
