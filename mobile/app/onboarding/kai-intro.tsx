import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { KaiTypingIntro } from "@/components/KaiTypingIntro";
import { OnboardingLayoutShell } from "@/components/onboarding/OnboardingLayoutShell";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const BOUNDARIES = [
  "No diagnosis",
  "No prescriptions",
  "Some concerns need a clinic visit",
  "Your doctor guides your care",
];

const WIDE_BREAKPOINT = 768;
const HERO_HEIGHT_PHONE = 220;
const HERO_HEIGHT_WIDE = 280;

export default function KaiIntroScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const heroHeight = isWide ? HERO_HEIGHT_WIDE : HERO_HEIGHT_PHONE;

  return (
    <OnboardingLayoutShell scanTheme={false} showHeader={false} showSignOut contentMaxWidth={896}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push("/onboarding/questionnaire" as Href)}
          hitSlop={8}
          style={styles.skipLinkWrap}
        >
          <Text style={styles.skipLink}>Skip to questionnaire</Text>
        </Pressable>

        <View style={[styles.heroRow, isWide && styles.heroRowWide]}>
          <View style={[styles.heroBanner, { height: heroHeight }, isWide && styles.heroWide]}>
            <Image
              source={require("../../assets/images/kai-skin-analysis.png")}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel="kAI advanced skin analysis — facial mapping with molecular insights"
            />
            <LinearGradient
              colors={["transparent", "rgba(24,24,27,0.2)", "rgba(24,24,27,0.9)"]}
              locations={[0, 0.35, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroKicker}>YOUR SKIN COMPANION</Text>
              <Text style={styles.heroTitle}>Meet kAI</Text>
              <Text style={styles.heroSub}>
                Take the same guided photos each time, so your skin changes are easier to follow.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.introSlot,
              isWide && { height: heroHeight, flex: 0.3 },
              !isWide && styles.introSlotStacked,
            ]}
          >
            <KaiTypingIntro showHeader={false} variant="sidebar" />
          </View>
        </View>

        <View style={styles.techShowcaseRow}>
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
              <Text style={styles.techTitle}>Real-time skin health metrics</Text>
            </View>
          </View>

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
              <Text style={styles.techTitle}>Track, analyse & improve your skin</Text>
            </View>
          </View>
        </View>

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
  heroRow: {
    gap: 16,
    marginBottom: 16,
  },
  heroRowWide: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 20,
  },
  heroBanner: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#18181b",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  heroWide: {
    flex: 0.7,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.9,
  },
  heroTextWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    zIndex: 2,
  },
  heroKicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#a8c4e6",
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  heroSub: {
    marginTop: 4,
    maxWidth: 320,
    fontSize: 12,
    lineHeight: 18,
    color: "#e4e4e7",
  },
  introSlot: {
    minWidth: 0,
    overflow: "visible",
  },
  introSlotStacked: {
    marginTop: -4,
  },
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
