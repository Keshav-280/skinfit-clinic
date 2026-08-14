import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";

import {
  DASHBOARD_CARD_BG,
  DASHBOARD_CARD_BORDER,
  DASHBOARD_NAVY,
  dashboardCardShadow,
} from "@/lib/dashboardTheme";

type Props = {
  message: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function FirstScanCta({ message, compact = false, style }: Props) {
  const router = useRouter();

  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <Text style={[styles.message, compact && styles.messageCompact]}>{message}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          compact && styles.buttonCompact,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => router.push("/onboarding/capture-intro" as Href)}
      >
        <Ionicons name="camera" size={compact ? 12 : 16} color="#fff" />
        <Text style={[styles.buttonText, compact && styles.buttonTextCompact]}>
          {compact ? "First scan" : "Take your first scan"}
        </Text>
        {!compact ? <Ionicons name="arrow-forward" size={16} color="#fff" /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DASHBOARD_CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DASHBOARD_CARD_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    ...dashboardCardShadow,
  },
  cardCompact: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 16,
    gap: 10,
  },
  message: {
    maxWidth: 280,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
  },
  messageCompact: {
    fontSize: 10,
    lineHeight: 14,
    maxWidth: 140,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: DASHBOARD_NAVY,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: DASHBOARD_NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  buttonTextCompact: {
    fontSize: 10,
  },
});
