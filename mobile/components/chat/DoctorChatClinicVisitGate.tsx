import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SKINFIT_THEME } from "@/lib/skinfitTheme";
import { DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE } from "../../../src/lib/patientClinicVisitMessages";

const NAVY = SKINFIT_THEME.navy;

type Props = {
  message?: string;
  variant?: "composer" | "empty" | "inline";
  onSupportPress: () => void;
};

export function DoctorChatClinicVisitGate({
  message = DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE,
  variant = "composer",
  onSupportPress,
}: Props) {
  if (variant === "inline") {
    return (
      <View style={styles.inlineCard}>
        <View style={styles.inlineIcon}>
          <Ionicons name="lock-closed" size={20} color="#fff" />
        </View>
        <View style={styles.inlineCopy}>
          <Text style={styles.inlineTitle}>Unlock after your clinic visit</Text>
          <Text style={styles.inlineBody}>{message}</Text>
          <Pressable onPress={onSupportPress} style={styles.inlineLink} hitSlop={8}>
            <Ionicons name="chatbubbles-outline" size={14} color="#A7F3D0" />
            <Text style={styles.inlineLinkText}>Contact Clinic Support</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (variant === "empty") {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="business-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.emptyTitle}>Doctor chat unlocks in clinic</Text>
          <Text style={styles.emptyBody}>{message}</Text>
          <Pressable style={styles.supportBtn} onPress={onSupportPress}>
            <Ionicons name="chatbubbles-outline" size={16} color={NAVY} />
            <Text style={styles.supportBtnText}>Contact Clinic Support</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.composerCard}>
      <View style={styles.composerIcon}>
        <Ionicons name="lock-closed" size={22} color="#fff" />
      </View>
      <Text style={styles.composerTitle}>Unlock after your clinic visit</Text>
      <Text style={styles.composerBody}>{message}</Text>
      <Pressable style={styles.supportBtn} onPress={onSupportPress}>
        <Ionicons name="chatbubbles-outline" size={16} color={NAVY} />
        <Text style={styles.supportBtnText}>Contact Clinic Support</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: NAVY,
    padding: 16,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  inlineIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineCopy: { flex: 1, minWidth: 0 },
  inlineTitle: { fontSize: 14, fontWeight: "800", color: "#fff" },
  inlineBody: { marginTop: 4, fontSize: 12, lineHeight: 17, color: "rgba(255,255,255,0.82)" },
  inlineLink: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  inlineLinkText: { fontSize: 12, fontWeight: "800", color: "#A7F3D0" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 22,
    backgroundColor: NAVY,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
  },
  composerCard: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: "center",
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  composerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  composerTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  composerBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
  },
  supportBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  supportBtnText: { fontSize: 14, fontWeight: "800", color: NAVY },
});
