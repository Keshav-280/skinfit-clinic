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

export type ObservationRow = {
  text: string;
  dateLabel?: string;
  source?: "baseline_scan" | "daily_logs" | "scan_trend" | "weekly_report";
};

type Props = {
  kaiScore: number;
  weeklyDelta: number;
  consistency: string;
  dateRange: string;
  observations: ObservationRow[] | string[];
  dataUsedSummary?: string | null;
  priorityActions: string[];
  insightsUnavailable?: boolean;
};

function sourceLabel(
  source: ObservationRow["source"]
): string | null {
  switch (source) {
    case "baseline_scan":
      return "Baseline scan";
    case "daily_logs":
      return "Daily logs";
    case "scan_trend":
      return "Scan trend";
    case "weekly_report":
      return "Weekly report";
    default:
      return null;
  }
}

function normalizeObservations(
  observations: ObservationRow[] | string[]
): ObservationRow[] {
  if (observations.length === 0) return [];
  if (typeof observations[0] === "string") {
    return (observations as string[]).map((text) => ({ text }));
  }
  return observations as ObservationRow[];
}

export default function WeeklyReportCard({
  kaiScore,
  weeklyDelta,
  consistency,
  dateRange,
  observations,
  dataUsedSummary,
  priorityActions,
  insightsUnavailable,
}: Props) {
  const deltaPositive = weeklyDelta >= 0;
  const deltaColor = deltaPositive ? GREEN : "#dc2626";
  const deltaText = deltaPositive ? `+${weeklyDelta}` : `${weeklyDelta}`;
  const rows = normalizeObservations(observations);

  return (
    <View style={card.base}>
      <Text style={s.title}>Last week&apos;s Report</Text>
      <Text style={s.dateRange}>{dateRange}</Text>
      {dataUsedSummary ? (
        <Text style={s.dataUsed}>{dataUsedSummary}</Text>
      ) : null}

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

      <View style={s.changeRow}>
        <View style={s.iconCircle}>
          <Ionicons name="trending-up" size={14} color={GREEN} />
        </View>
        <Text style={s.changeLabel}>Weekly Change</Text>
        <Text style={[s.changeValue, { color: deltaColor }]}>{deltaText}</Text>
      </View>

      <View style={s.divider} />

      <View style={s.section}>
        <Text style={s.sectionTitle}>
          Key Observations{" "}
          <Text style={s.sectionHint}>
            ({rows.length} things to know)
          </Text>
        </Text>
        {rows.length > 0 ? (
          rows.map((item, i) => {
            const tag = sourceLabel(item.source);
            return (
              <View key={i} style={s.listItem}>
                <View style={[s.badge, { backgroundColor: "#dcfce7" }]}>
                  <Text style={[s.badgeText, { color: GREEN }]}>{i + 1}</Text>
                </View>
                <View style={s.listBody}>
                  {item.dateLabel || tag ? (
                    <View style={s.metaRow}>
                      {item.dateLabel ? (
                        <Text style={s.dateLabel}>{item.dateLabel}</Text>
                      ) : null}
                      {tag ? (
                        <Text style={s.sourceTag}>{tag}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  <Text style={s.listText}>{item.text}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={s.emptyHint}>
            {insightsUnavailable
              ? "Insights are temporarily unavailable. Pull to refresh in a moment."
              : "Generating observations… pull to refresh in a moment."}
          </Text>
        )}
      </View>

      <View style={s.divider} />

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
            {insightsUnavailable
              ? "Priority actions are temporarily unavailable. Pull to refresh in a moment."
              : "Generating priority actions… pull to refresh."}
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
  },
  dataUsed: {
    fontSize: 11,
    color: TEXT_LIGHT,
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 16,
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
  listBody: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
  },
  sourceTag: {
    fontSize: 10,
    fontWeight: "600",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
