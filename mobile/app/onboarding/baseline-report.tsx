import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";

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
  const { token, markOnboardingComplete } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function finish() {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const id = Number.parseInt(scanId ?? "", 10);
      await apiJson("/api/onboarding/complete", token, {
        method: "POST",
        body: JSON.stringify(
          Number.isFinite(id) ? { baselineScanId: id } : {}
        ),
      });
      await markOnboardingComplete();
      router.replace("/(drawer)" as Href);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not finish onboarding.");
    } finally {
      setBusy(false);
    }
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
          Your kAI baseline report is saved. Your doctor will be notified. You can open the full report from
          Treatment History anytime.
        </Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.btn, busy && styles.dis, pressed && !busy && styles.btnPressed]}
          onPress={() => void finish()}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Go to dashboard</Text>}
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
  wrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
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
  err: { color: "#DC2626", textAlign: "center", marginTop: 12, fontWeight: "600" },
  btn: {
    marginTop: 28,
    backgroundColor: NAVY,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  btnPressed: {
    backgroundColor: NAVY_DARK,
    transform: [{ scale: 0.98 }],
  },
  dis: { opacity: 0.45 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
  linkBtn: { marginTop: 18, alignItems: "center" },
  link: { color: NAVY, fontWeight: "700", fontSize: 15 },
});
