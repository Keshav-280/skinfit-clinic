import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const NAVY_LIGHT = "#E8EFF8";

const HIGHLIGHTS = [
  { icon: "scan-outline" as const, title: "Five-angle scans", caption: "Same flow every week" },
  { icon: "trending-up-outline" as const, title: "Weekly trends", caption: "Progress over time" },
  { icon: "sparkles-outline" as const, title: "Personal focus", caption: "Short, clear guidance" },
];

const BOUNDARIES = ["Not a diagnosis", "Not a prescription", "Doctor leads care"];

export default function KaiIntroScreen() {
  const router = useRouter();
  return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>YOUR SKIN COMPANION</Text>
        <Text style={styles.title}>Meet kAI</Text>
        <Text style={styles.body}>Eight skin parameters. One clear picture of what&apos;s working.</Text>

        <View style={styles.highlightGrid}>
          {HIGHLIGHTS.map((item) => (
            <View key={item.title} style={styles.highlightCard}>
              <View style={styles.highlightIcon}>
                <Ionicons name={item.icon} size={20} color={NAVY_DARK} />
              </View>
              <Text style={styles.highlightTitle}>{item.title}</Text>
              <Text style={styles.highlightCaption}>{item.caption}</Text>
            </View>
          ))}
        </View>

        <View style={styles.boundaryBox}>
          <View style={styles.boundaryHead}>
            <Ionicons name="shield-checkmark-outline" size={16} color={NAVY_DARK} />
            <Text style={styles.boundaryKicker}>GOOD TO KNOW</Text>
          </View>
          <View style={styles.boundaryRow}>
            {BOUNDARIES.map((line) => (
              <View key={line} style={styles.boundaryPill}>
                <Text style={styles.boundaryText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => router.push("/onboarding/capture-intro" as Href)}
        >
          <LinearGradient colors={[NAVY, NAVY_DARK]} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.btnText}>Start baseline scan</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </LinearGradient>
        </Pressable>
        <Text style={styles.hint}>~2 min · 5 guided photos</Text>
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  brand: {
    alignSelf: "center",
    marginTop: 4,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: NAVY_DARK,
  },
  kicker: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: "#3d5080",
    textAlign: "center",
  },
  title: {
    marginTop: 10,
    fontSize: 34,
    fontWeight: "800",
    color: NAVY_DARK,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: "#52525b",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  highlightGrid: { marginTop: 28, gap: 10 },
  highlightCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  highlightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: NAVY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  highlightTitle: { fontSize: 15, fontWeight: "800", color: NAVY_DARK },
  highlightCaption: { marginTop: 4, fontSize: 12, lineHeight: 17, color: "#71717a" },
  boundaryBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(44,62,107,0.05)",
    borderWidth: 1,
    borderColor: "rgba(44,62,107,0.1)",
  },
  boundaryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  boundaryKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: NAVY_DARK,
  },
  boundaryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  boundaryPill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  boundaryText: { fontSize: 11, fontWeight: "600", color: "#52525b" },
  btn: {
    marginTop: 28,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  btnPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  btnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    paddingHorizontal: 24,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  hint: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "600",
    color: "#78716c",
    textAlign: "center",
  },
});
