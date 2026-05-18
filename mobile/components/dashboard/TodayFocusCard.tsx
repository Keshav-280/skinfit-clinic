import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { apiUrl } from "@/lib/apiBase";
import { splitTodayFocusMessage } from "@/lib/splitTodayFocusMessage";

const FOCUS_GREEN = "#2E7D32";

const PORTRAIT_URI = apiUrl("/images/todays-focus-portrait.png");

export function TodayFocusCard({ message }: { message: string }) {
  const { width } = useWindowDimensions();
  const layoutRow = width >= 380;
  const { headline, detail } = splitTodayFocusMessage(message);

  return (
    <LinearGradient
      colors={["#ffffff", "#f4fdf7", "#ecfdf5", "#d1fae5"]}
      locations={[0, 0.4, 0.74, 1]}
      style={styles.card}
    >
      <View style={[styles.inner, layoutRow && styles.innerRow]}>
        <View style={[styles.copy, layoutRow && styles.copyRow]}>
          <View style={styles.kickerRow}>
            <Ionicons name="sparkles" size={16} color={FOCUS_GREEN} />
            <Text style={styles.kicker}>Today&apos;s Focus</Text>
          </View>
          <Text style={styles.headline}>{headline}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>

        <View style={[styles.portraitCol, layoutRow && styles.portraitColRow]}>
          <View style={styles.portraitGlow} />
          <View style={styles.portraitRing}>
            <Image
              source={{ uri: PORTRAIT_URI }}
              style={styles.portrait}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(167,243,208,0.9)",
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  inner: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  innerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  copyRow: {
    flex: 1,
    paddingRight: 4,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: FOCUS_GREEN,
    textTransform: "uppercase",
  },
  headline: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    color: "#171717",
  },
  detail: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
    color: "#525252",
  },
  portraitCol: {
    alignSelf: "center",
    width: 200,
    height: 200,
  },
  portraitColRow: {
    width: 168,
    height: 168,
    flexShrink: 0,
  },
  portraitGlow: {
    position: "absolute",
    top: "-8%",
    left: "-8%",
    right: "-8%",
    bottom: "-8%",
    borderRadius: 999,
    backgroundColor: "rgba(167,243,208,0.45)",
    opacity: 0.55,
  },
  portraitRing: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#fff",
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  portrait: {
    width: "100%",
    height: "100%",
  },
});
