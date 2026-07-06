import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import {
  MEDICAL_DISCLAIMER_CHAT_AI,
  MEDICAL_DISCLAIMER_CHAT_DOCTOR,
} from "@/lib/medicalDisclaimer";

type Props = {
  variant: "ai" | "doctor";
};

export function MedicalDisclaimerBanner({ variant }: Props) {
  const text =
    variant === "ai" ? MEDICAL_DISCLAIMER_CHAT_AI : MEDICAL_DISCLAIMER_CHAT_DOCTOR;

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Ionicons name="information-circle-outline" size={14} color="#64748b" style={styles.icon} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  icon: { marginTop: 1 },
  text: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: "#64748b",
  },
});
