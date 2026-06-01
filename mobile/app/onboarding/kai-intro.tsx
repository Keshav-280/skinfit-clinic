import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const NAVY_LIGHT = "#E8EFF8";

const HIGHLIGHTS = [
  {
    icon: "scan-outline" as const,
    title: "Five-angle photos",
    caption: "Same angles each time, easier to compare",
  },
  {
    icon: "trending-up-outline" as const,
    title: "Progress over time",
    caption: "Look at the trend, not just one scan",
  },
  {
    icon: "sparkles-outline" as const,
    title: "Simple next steps",
    caption: "Small routine nudges based on your skin",
  },
];

const BOUNDARIES = [
  "No diagnosis",
  "No prescriptions",
  "Some concerns need a clinic visit",
  "Doctor guides care",
];

export default function KaiIntroScreen() {
  const router = useRouter();
  
  return (
    <LinearGradient colors={["#D6E4D0", "#E0EADA", "#EAF0E6"]} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* ─── Hero Image with text overlay ─── */}
        <View style={styles.heroCard}>
          <Image
            source={require("../../assets/images/kai-skin-analysis.png")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(30,50,100,0.85)"]}
            style={styles.heroGradient}
          />
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroKicker}>YOUR SKIN COMPANION</Text>
            <Text style={styles.heroTitle}>Meet kAI</Text>
            <Text style={styles.heroSubtitle}>
              Take the same guided photos each time, so your skin changes are easier to follow.
            </Text>
          </View>
        </View>

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

        {/* ─── Horizontal Feature List items ─── */}
        <View style={styles.highlightList}>
          {HIGHLIGHTS.map((item) => (
            <View key={item.title} style={styles.highlightListItem}>
              <View style={styles.highlightIcon}>
                <Ionicons name={item.icon} size={18} color={NAVY_DARK} />
              </View>
              <View style={styles.highlightText}>
                <Text style={styles.highlightTitle}>{item.title}</Text>
                <Text style={styles.highlightCaption}>{item.caption}</Text>
              </View>
            </View>
          ))}
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

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  
  // Hero Styles
  heroCard: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTextContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  heroKicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#a8c4e6",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
  },

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
    ...StyleSheet.absoluteFillObject,
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

  // Highlights List
  highlightList: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 20,
    padding: 12,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  highlightListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  highlightIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: NAVY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  highlightText: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: NAVY_DARK,
  },
  highlightCaption: {
    fontSize: 10.5,
    color: "#71717a",
    marginTop: 2.5,
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
});
