import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";

const TEAL = "#0d9488";

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
    <View style={styles.wrap}>
      <Text style={styles.title}>Baseline captured</Text>
      <Text style={styles.body}>
        Your kAI baseline report is saved. Your doctor will be notified. You can open the full report from
        Treatment History anytime.
      </Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable style={[styles.btn, busy && styles.dis]} onPress={() => void finish()} disabled={busy}>
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#fdf9f0",
    padding: 24,
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#18181b", textAlign: "center" },
  body: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: "#52525b",
    textAlign: "center",
  },
  err: { color: "#b91c1c", textAlign: "center", marginTop: 12 },
  btn: {
    marginTop: 28,
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  dis: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 16, alignItems: "center" },
  link: { color: TEAL, fontWeight: "700" },
});
