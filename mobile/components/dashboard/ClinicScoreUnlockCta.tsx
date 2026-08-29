import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CLINIC_SCORE_UNLOCK } from "../../../src/lib/clarityGrade";
import { dashboardCardShadow } from "@/lib/dashboardTheme";

const NAVY = "#1E1B31";

type Props = {
  compact?: boolean;
  style?: object;
};

export function ClinicScoreUnlockCta({ compact = false, style }: Props) {
  const router = useRouter();

  return (
    <View style={[styles.shell, compact && styles.shellCompact, style]}>
      <LinearGradient
        colors={["rgba(255,255,255,0.98)", "#F8FBFF", "#E8EFF8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact && styles.cardCompact]}
      >
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={compact ? 15 : 17} color={NAVY} />
          </View>
          <Text style={[styles.title, compact && styles.titleCompact]}>
            {CLINIC_SCORE_UNLOCK.title}
          </Text>
        </View>

        <Text style={[styles.message, compact && styles.messageCompact]}>
          {CLINIC_SCORE_UNLOCK.message}
        </Text>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() =>
            router.push(CLINIC_SCORE_UNLOCK.mobileSchedulesHref as Href)
          }
        >
          <Ionicons name="calendar-outline" size={15} color="#fff" />
          <Text style={styles.btnText}>{CLINIC_SCORE_UNLOCK.actionLabel}</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(30, 27, 49,0.14)",
    ...dashboardCardShadow,
  },
  shellCompact: {
    marginBottom: 12,
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardCompact: {
    paddingVertical: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(30, 27, 49,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: NAVY,
    lineHeight: 20,
  },
  titleCompact: {
    fontSize: 14,
    lineHeight: 19,
  },
  message: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "#5B66A1",
  },
  messageCompact: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  btn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
