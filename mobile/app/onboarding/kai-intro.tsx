import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KaiTypingIntro } from "@/components/KaiTypingIntro";
import { useAuth } from "@/contexts/AuthContext";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const BOUNDARIES = [
  "No diagnosis",
  "No prescriptions",
  "Some concerns need a clinic visit",
  "Doctor guides care",
];

const GRADIENT_TOP = "#D6E4D0";

export default function KaiIntroScreen() {
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
    <LinearGradient colors={[GRADIENT_TOP, "#E0EADA", "#EAF0E6"]} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        
        <KaiTypingIntro />

        {/* ─── Side-by-Side Tech Showcase ─── */}
        <View style={styles.techShowcaseRow}>
          {/* Dashboard Preview */}
          <View style={styles.techCard}>
            <Image
              source={require("../../assets/images/kai-holographic-scan.png")}
              style={styles.techImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.75)"]}
              style={styles.techGradient}
            />
            <View style={styles.techTextContainer}>
              <Text style={styles.techKicker}>DASHBOARD</Text>
              <Text style={styles.techTitle}>Real-time metrics</Text>
            </View>
          </View>

          {/* Insights Preview */}
          <View style={styles.techCard}>
            <Image
              source={require("../../assets/images/kai-features-visual.png")}
              style={styles.techImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.75)"]}
              style={styles.techGradient}
            />
            <View style={styles.techTextContainer}>
              <Text style={styles.techKicker}>INSIGHTS</Text>
              <Text style={styles.techTitle}>Track & improve</Text>
            </View>
          </View>
        </View>

        {/* ─── Boundary Warnings Box ─── */}
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
        </View>

        {/* ─── Start Baseline Scan button ─── */}
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

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
          onPress={() => void handleSignOut()}
        >
          <Ionicons name="log-out-outline" size={18} color="#52525b" style={{ marginRight: 6 }} />
          <Text style={styles.signOutBtnText}>Sign out</Text>
        </Pressable>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  
  // Tech Showcase
  techShowcaseRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  techCard: {
    flex: 1,
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  techImage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  techGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  techTextContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  techKicker: {
    fontSize: 8,
    fontWeight: "800",
    color: "#a8c4e6",
    letterSpacing: 1,
  },
  techTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    marginTop: 2,
  },

  // Boundaries
  boundaryBox: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(44,62,107,0.05)",
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
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  boundaryText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#52525b",
  },

  // Button
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
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    paddingVertical: 15,
    borderRadius: 16,
  },
  signOutBtnPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    transform: [{ scale: 0.98 }],
  },
  signOutBtnText: {
    color: "#52525b",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
