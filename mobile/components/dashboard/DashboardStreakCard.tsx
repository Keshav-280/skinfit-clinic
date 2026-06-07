import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  DASHBOARD_BG,
  DASHBOARD_CARD_BG,
  DASHBOARD_CARD_BORDER,
  DASHBOARD_GREEN,
  DASHBOARD_NAVY,
  dashboardCardShadow,
} from "@/lib/dashboardTheme";

type StreakDay = {
  label: string;
  done: boolean;
  isFuture?: boolean;
};

type Props = {
  streakCurrent: number;
  streakLongest: number;
  weekDoneCount: number;
  streakDays: StreakDay[];
  allRoutineDone: boolean;
  routinePlanReady: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function DashboardStreakCard({
  streakCurrent,
  streakLongest,
  weekDoneCount,
  streakDays,
  allRoutineDone,
  routinePlanReady,
  compact = false,
  style,
}: Props) {
  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <Text style={[styles.title, compact && styles.titleCompact]}>
        {streakCurrent} day streak
      </Text>
      <Text style={[styles.personalBest, compact && styles.personalBestCompact]}>
        Personal best: {streakLongest} days
      </Text>
      <View style={styles.weekHeader}>
        <Text style={[styles.weekLabel, compact && styles.weekLabelCompact]}>THIS WEEK</Text>
        <Text style={[styles.weekLabel, compact && styles.weekLabelCompact]}>
          {weekDoneCount}/7 complete
        </Text>
      </View>
      <View style={[styles.weekTrack, compact && styles.weekTrackCompact]}>
        <View
          style={[styles.weekFill, { width: `${Math.round((weekDoneCount / 7) * 100)}%` }]}
        />
      </View>
      <View style={styles.dotsRow}>
        {streakDays.map((d, i) => (
          <View key={`s-${i}`} style={styles.dayCol}>
            <View
              style={[
                styles.dot,
                compact && styles.dotCompact,
                d.done && styles.dotDone,
                d.isFuture && !d.done && styles.dotFuture,
              ]}
            >
              {d.done ? (
                <Ionicons name="checkmark" size={compact ? 10 : 14} color="#fff" />
              ) : (
                <Text style={[styles.dotLetter, compact && styles.dotLetterCompact]}>
                  {d.label.charAt(0)}
                </Text>
              )}
            </View>
            {!compact ? <Text style={styles.dayLabel}>{d.label}</Text> : null}
          </View>
        ))}
      </View>
      {routinePlanReady ? (
        <Text
          style={[
            styles.completeToday,
            compact && styles.completeTodayCompact,
            allRoutineDone ? { color: DASHBOARD_GREEN } : { color: DASHBOARD_NAVY },
          ]}
        >
          {allRoutineDone ? "Done today" : "Complete today"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DASHBOARD_CARD_BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: DASHBOARD_CARD_BORDER,
    ...dashboardCardShadow,
  },
  cardCompact: {
    borderRadius: 16,
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: DASHBOARD_NAVY,
    marginBottom: 4,
  },
  titleCompact: {
    fontSize: 14,
    lineHeight: 16,
  },
  personalBest: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
  },
  personalBestCompact: {
    fontSize: 10,
    marginBottom: 8,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  weekLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.3,
  },
  weekTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: DASHBOARD_BG,
    overflow: "hidden",
    marginBottom: 16,
  },
  weekTrackCompact: {
    height: 6,
    marginBottom: 10,
  },
  weekFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: DASHBOARD_GREEN,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  dayCol: { alignItems: "center", gap: 6 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  dotCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  dotDone: { backgroundColor: DASHBOARD_GREEN, borderColor: DASHBOARD_GREEN },
  dotFuture: {
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  dotLetter: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  dotLetterCompact: {
    fontSize: 8,
  },
  dayLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  completeToday: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
  },
  completeTodayCompact: {
    fontSize: 11,
    marginTop: 8,
  },
});
