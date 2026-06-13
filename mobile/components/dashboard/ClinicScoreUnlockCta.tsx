import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CLINIC_SCORE_UNLOCK } from "../../../src/lib/clarityGrade";

const NAVY = "#2C3E6B";

type Props = {
  compact?: boolean;
  style?: object;
};

export function ClinicScoreUnlockCta({ compact = false, style }: Props) {
  const router = useRouter();

  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={16} color={NAVY} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{CLINIC_SCORE_UNLOCK.title}</Text>
          <Text style={[styles.message, compact && styles.messageCompact]}>
            {CLINIC_SCORE_UNLOCK.message}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={() =>
              router.push(CLINIC_SCORE_UNLOCK.mobileSchedulesHref as Href)
            }
          >
            <Ionicons name="calendar-outline" size={14} color="#fff" />
            <Text style={styles.btnText}>{CLINIC_SCORE_UNLOCK.actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(44,62,107,0.14)",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardCompact: {
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(44,62,107,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: NAVY,
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#3d5080",
  },
  messageCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  btn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 12,
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnPressed: {
    opacity: 0.88,
  },
  btnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});
