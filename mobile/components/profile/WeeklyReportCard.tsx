import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  card,
  NAVY,
  GREEN,
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_LIGHT,
  BORDER_LIGHT,
} from "@/components/profile/theme";

type Props = {
  kaiScore: number;
  weeklyDelta: number;
  consistency: string;
  dateRange: string;
  observations: string[];
  priorityActions: string[];
};

export default function WeeklyReportCard({
  kaiScore,
  weeklyDelta,
  consistency,
  dateRange,
  observations,
  priorityActions,
}: Props) {
  const deltaPositive = weeklyDelta >= 0;
  const deltaColor = deltaPositive ? GREEN : "#dc2626";
  const deltaText = deltaPositive ? `+${weeklyDelta}` : `${weeklyDelta}`;

  return (
    <View style={card.base}>
      {/* Header */}
      <Text style={s.title}>Last week&apos;s Report</Text>
      <Text style={s.dateRange}>{dateRange}</Text>

      {/* Metric pills */}
      <View style={s.pillRow}>
        <View style={s.pill}>
          <View style={s.iconCircle}>
            <Ionicons name="star" size={14} color={GREEN} />
          </View>
          <View>
            <Text style={s.pillLabel}>Average Score</Text>
            <Text style={s.pillValue}>
              {kaiScore}
              <Text style={s.pillUnit}>/100</Text>
            </Text>
          </View>
        </View>

        <View style={s.pill}>
          <View style={s.iconCircle}>
            <Ionicons name="checkmark" size={14} color={GREEN} />
          </View>
          <View>
            <Text style={s.pillLabel}>Consistency</Text>
            <Text style={s.pillValue}>{consistency}</Text>
          </View>
        </View>
      </View>

      {/* Weekly change */}
      <View style={s.changeRow}>
        <View style={s.iconCircle}>
          <Ionicons name="trending-up" size={14} color={GREEN} />
        </View>
        <Text style={s.changeLabel}>Weekly Change</Text>
        <Text style={[s.changeValue, { color: deltaColor }]}>{deltaText}</Text>
      </View>

      <View style={s.divider} />

      {/* Key Observations */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>
          Key Observations{" "}
          <Text style={s.sectionHint}>
            ({observations.length} things to know)
          </Text>
        </Text>
        {observations.length > 0 ? (
          observations.map((item, i) => (
            <View key={i} style={s.listItem}>
              <View style={[s.badge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[s.badgeText, { color: GREEN }]}>{i + 1}</Text>
              </View>
              <Text style={s.listText}>{item}</Text>
            </View>
          ))
        ) : (
          <Text style={s.emptyHint}>
            Observations will appear here after your next weekly report.
          </Text>
        )}
      </View>

      <View style={s.divider} />

      {/* Priority Actions */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>
          Priority Actions{" "}
          <Text style={s.sectionHint}>
            ({priorityActions.length} things to do)
          </Text>
        </Text>
        {priorityActions.length > 0 ? (
          priorityActions.map((item, i) => (
            <View key={i} style={s.listItem}>
              <View style={[s.badge, { backgroundColor: "#e0e7ff" }]}>
                <Text style={[s.badgeText, { color: NAVY }]}>{i + 1}</Text>
              </View>
              <Text style={s.listText}>{item}</Text>
            </View>
          ))
        ) : (
          <Text style={s.emptyHint}>
            Actions will appear here once enough scan data is collected.
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  dateRange: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 2,
    marginBottom: 16,
  },
  pillRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_LIGHT,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  pillLabel: {
    fontSize: 12,
    color: TEXT_LIGHT,
    marginBottom: 1,
  },
  pillValue: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  pillUnit: {
    fontSize: 13,
    fontWeight: "400",
    color: TEXT_MUTED,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  changeLabel: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  changeValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_LIGHT,
    marginVertical: 14,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  sectionHint: {
    fontWeight: "400",
    color: TEXT_MUTED,
    fontSize: 13,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  emptyHint: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontStyle: "italic",
    lineHeight: 18,
  },
});
