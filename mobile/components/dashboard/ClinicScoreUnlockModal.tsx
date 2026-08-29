import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { CLINIC_SCORE_UNLOCK } from "../../../src/lib/clarityGrade";

const NAVY = "#1E1B31";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ClinicScoreUnlockModal({ visible, onClose }: Props) {
  const router = useRouter();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-closed" size={20} color={NAVY} />
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={10}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color="#52525b" />
            </Pressable>
          </View>

          <Text style={styles.title}>{CLINIC_SCORE_UNLOCK.title}</Text>
          <Text style={styles.message}>{CLINIC_SCORE_UNLOCK.message}</Text>

          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => {
              onClose();
              router.push(CLINIC_SCORE_UNLOCK.mobileSchedulesHref as Href);
            }}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={styles.ctaText}>{CLINIC_SCORE_UNLOCK.actionLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "#fff",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30, 27, 49,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
    padding: 8,
  },
  title: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    color: NAVY,
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#5B66A1",
  },
  cta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 12,
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
