import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const NAVY_LIGHT = "#E2E8F0";

export default function KaiIntroScreen() {
  const router = useRouter();
  return (
    <LinearGradient colors={["#E8EFE6", "#DCE8D4"]} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <LinearGradient colors={[NAVY, NAVY_DARK]} style={styles.iconGrad}>
            <Ionicons name="sparkles" size={34} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={styles.kicker}>YOUR SKIN COMPANION</Text>
        <Text style={styles.title}>Meet kAI</Text>
        <Text style={styles.body}>
          kAI reads your photos across many skin parameters, spots trends when you stay
          consistent, and turns that into clear, personal guidance.
        </Text>

        <View style={styles.cardPrimary}>
          <View style={styles.cardHead}>
            <View style={styles.badgePrimary}>
              <Ionicons name="checkmark-done" size={20} color={NAVY_DARK} />
            </View>
            <Text style={styles.cardTitle}>What kAI does</Text>
          </View>
          <FeatureRow
            icon="scan-outline"
            bold="Five-angle scoring"
            text=" — standardised photos, metrics you can trust week to week."
          />
          <FeatureRow
            icon="trending-up-outline"
            bold="Trends, not one-offs"
            text=" — highlights progress when you keep up scans and routines."
          />
          <FeatureRow
            icon="chatbubble-ellipses-outline"
            bold="Plain-language focus"
            text=" — actionable nudges; your doctor still leads your care plan."
          />
        </View>

        <View style={styles.cardAmber}>
          <View style={styles.cardHead}>
            <View style={styles.badgeAmber}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#92400E" />
            </View>
            <Text style={styles.cardTitle}>What kAI doesn&apos;t do</Text>
          </View>
          <PlainRow
            icon="medical-outline"
            text={
              <>
                <Text style={styles.bold}>No diagnosis or prescriptions</Text>
                <Text style={styles.plain}> — it doesn&apos;t replace medical judgment.</Text>
              </>
            }
          />
          <PlainRow
            icon="shield-outline"
            text={
              <>
                <Text style={styles.bold}>Not a full exam</Text>
                <Text style={styles.plain}>
                  {" "}
                  — some measures still need your clinician in person.
                </Text>
              </>
            }
          />
          <PlainRow
            icon="alert-circle-outline"
            text={
              <>
                <Text style={styles.bold}>No guaranteed outcomes</Text>
                <Text style={styles.plain}>
                  {" "}
                  — your doctor sets the plan; kAI supports the journey.
                </Text>
              </>
            }
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => router.push("/onboarding/questionnaire" as Href)}
        >
          <LinearGradient colors={[NAVY, NAVY_DARK]} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.btnText}>Continue to questionnaire</Text>
            <Ionicons name="sparkles" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </LinearGradient>
        </Pressable>
        <Text style={styles.hint}>About 5–8 minutes · shapes your first kAI profile</Text>
      </ScrollView>
    </LinearGradient>
  );
}

function FeatureRow({
  icon,
  bold,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bold: string;
  text: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color={NAVY_DARK} />
      </View>
      <Text style={styles.featureText}>
        <Text style={styles.bold}>{bold}</Text>
        <Text style={styles.plain}>{text}</Text>
      </Text>
    </View>
  );
}

function PlainRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: ReactNode;
}) {
  return (
    <View style={styles.plainRow}>
      <Ionicons name={icon} size={18} color="#92400E" style={styles.plainIcon} />
      <Text style={styles.plainText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  iconWrap: { alignItems: "center", marginTop: 8 },
  iconGrad: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  kicker: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: NAVY_DARK,
    textAlign: "center",
  },
  title: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1A2E",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: "#52525b",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  cardPrimary: {
    marginTop: 28,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(13, 148, 136, 0.2)",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  cardAmber: {
    marginTop: 16,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "rgba(146, 64, 14, 0.15)",
    shadowColor: "#92400E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  badgePrimary: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: NAVY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeAmber: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(146, 64, 14, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#1A1A2E", flex: 1 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: NAVY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, fontSize: 14, lineHeight: 21, color: "#374151" },
  plainRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  plainIcon: { marginTop: 2 },
  plainText: { flex: 1, fontSize: 14, lineHeight: 21, color: "#44403c" },
  bold: { fontWeight: "700", color: "#1A1A2E" },
  plain: { fontWeight: "400", color: "#6B7280" },
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
    fontSize: 12,
    color: "#78716c",
    textAlign: "center",
  },
});
