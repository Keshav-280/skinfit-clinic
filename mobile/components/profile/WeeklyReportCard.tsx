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
import {
  formatInsightUnlockDate,
  friendlyObservationTitle,
  parsePriorityAction,
  softenPatientText,
  trendSummary,
  type ObservationSource,
} from "@/lib/weeklyInsightFormat";
import { patientKaiScoreView } from "../../src/lib/clarityGrade";

export type ObservationRow = {
  text: string;
  dateLabel?: string;
  source?: ObservationSource;
};

type Props = {
  locked?: boolean;
  nextInsightAt?: string | null;
  kaiScore: number;
  weeklyDelta: number;
  consistency: string;
  dateRange: string;
  showTrend?: boolean;
  observations: ObservationRow[] | string[];
  dataUsedSummary?: string | null;
  priorityActions: string[];
  observationsUnavailable?: boolean;
  actionsUnavailable?: boolean;
  scoresUnlocked?: boolean;
};

function formatInsightDate(iso: string): string {
  return formatInsightUnlockDate(iso) || "7 days after your first scan";
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

function observationAccent(source?: ObservationSource) {
  switch (source) {
    case "baseline_scan":
      return { bg: "#eef2ff", border: "#c7d2fe", icon: "flag-outline" as const };
    case "daily_logs":
      return { bg: "#ecfdf5", border: "#a7f3d0", icon: "calendar-outline" as const };
    case "scan_trend":
      return { bg: "#eff6ff", border: "#bfdbfe", icon: "analytics-outline" as const };
    case "weekly_report":
      return { bg: "#fdf4ff", border: "#e9d5ff", icon: "sparkles-outline" as const };
    default:
      return { bg: "#f8fafc", border: BORDER_LIGHT, icon: "bulb-outline" as const };
  }
}

export default function WeeklyReportCard({
  locked = false,
  nextInsightAt,
  kaiScore,
  weeklyDelta,
  consistency,
  dateRange,
  showTrend = true,
  observations,
  dataUsedSummary,
  priorityActions,
  observationsUnavailable,
  actionsUnavailable,
  scoresUnlocked = false,
}: Props) {
  const rows = normalizeObservations(observations);
  const trend = trendSummary(weeklyDelta);
  const kaiView = patientKaiScoreView(kaiScore, scoresUnlocked);
  const parsedActions = priorityActions.map(parsePriorityAction);

  return (
    <View style={card.base}>
      <Text style={s.title}>Weekly insight</Text>
      <Text style={s.dateRange}>
        {locked ? "7 days after your first scan" : dateRange}
      </Text>

      {locked ? (
        <View style={s.lockedWrap}>
          <View style={s.lockCircle}>
            <Ionicons name="lock-closed" size={22} color={TEXT_LIGHT} />
          </View>
          <Text style={s.lockedText}>Your first weekly summary unlocks around</Text>
          <Text style={s.lockedDate}>
            {nextInsightAt
              ? formatInsightDate(nextInsightAt)
              : "7 days after your first scan"}
          </Text>
          <Text style={s.lockedHint}>
            Keep scanning and logging daily — we&apos;ll build your week-one recap.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.snapshot}>
            <View style={s.snapshotMain}>
              <Text style={s.snapshotLabel}>Your skin grade</Text>
              <View style={s.scoreRow}>
                <Text style={s.scoreValue}>
                  {kaiView.showLock ? kaiView.kaiSecondary : kaiView.kaiPrimary}
                </Text>
              </View>
            </View>
            <View style={s.snapshotSide}>
              {showTrend ? (
                <View style={s.trendPill}>
                  <Ionicons
                    name={
                      trend.tone === "up"
                        ? "trending-up"
                        : trend.tone === "down"
                          ? "trending-down"
                          : "remove-outline"
                    }
                    size={14}
                    color={trend.tone === "down" ? "#dc2626" : GREEN}
                  />
                  <Text
                    style={[
                      s.trendText,
                      trend.tone === "down" && { color: "#dc2626" },
                    ]}
                  >
                    {trend.label}
                  </Text>
                </View>
              ) : (
                <Text style={s.trendPlaceholder}>Trend after 2nd scan</Text>
              )}
              <Text style={s.consistencyText}>Habits: {consistency}</Text>
            </View>
          </View>

          {dataUsedSummary ? (
            <Text style={s.dataUsed}>{dataUsedSummary}</Text>
          ) : null}

          <View style={s.divider} />

          <View style={s.section}>
            <Text style={s.sectionTitle}>What we noticed</Text>
            <Text style={s.sectionSub}>Short highlights from your scans and logs</Text>
            {rows.length > 0 ? (
              rows.map((item, i) => {
                const accent = observationAccent(item.source);
                const title = friendlyObservationTitle(item.source);
                return (
                  <View
                    key={i}
                    style={[
                      s.observationCard,
                      { backgroundColor: accent.bg, borderColor: accent.border },
                    ]}
                  >
                    <View style={s.observationHeader}>
                      <Ionicons name={accent.icon} size={16} color={NAVY} />
                      <Text style={s.observationTitle}>{title}</Text>
                    </View>
                    {item.dateLabel ? (
                      <Text style={s.observationMeta}>{item.dateLabel}</Text>
                    ) : null}
                    <Text style={s.observationBody}>
                      {softenPatientText(item.text)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={s.emptyHint}>
                {observationsUnavailable
                  ? "Insights are temporarily unavailable. Pull to refresh in a moment."
                  : "Generating observations… pull to refresh in a moment."}
              </Text>
            )}
          </View>

          <View style={s.divider} />

          <View style={s.section}>
            <Text style={s.sectionTitle}>Your focus this week</Text>
            <Text style={s.sectionSub}>Three simple steps — one at a time</Text>
            {parsedActions.length > 0 ? (
              parsedActions.map((action, i) => (
                <View key={i} style={s.actionCard}>
                  <View style={s.actionHeader}>
                    <View style={s.actionBadge}>
                      <Text style={s.actionBadgeText}>{i + 1}</Text>
                    </View>
                    <Text style={s.actionTitle}>{action.title}</Text>
                  </View>
                  {action.do ? (
                    <View style={s.actionDoRow}>
                      <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                      <Text style={s.actionDoText}>{action.do}</Text>
                    </View>
                  ) : (
                    <Text style={s.actionDoText}>
                      {softenPatientText(priorityActions[i] ?? "")}
                    </Text>
                  )}
                  {action.target ? (
                    <View style={s.targetPill}>
                      <Text style={s.targetLabel}>Goal</Text>
                      <Text style={s.targetText}>{action.target}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={s.emptyHint}>
                {actionsUnavailable
                  ? "Priority actions are temporarily unavailable. Pull to refresh in a moment."
                  : "Generating priority actions… pull to refresh."}
              </Text>
            )}
          </View>
        </>
      )}
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
    marginBottom: 12,
  },
  lockedWrap: {
    alignItems: "center",
    paddingVertical: 28,
  },
  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  lockedDate: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
  },
  lockedHint: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  snapshot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_LIGHT,
    padding: 14,
    marginBottom: 8,
  },
  snapshotMain: {
    flex: 1,
  },
  snapshotLabel: {
    fontSize: 12,
    color: TEXT_LIGHT,
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "800",
    color: NAVY,
    lineHeight: 34,
  },
  scoreUnit: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  snapshotSide: {
    alignItems: "flex-end",
    gap: 6,
    minWidth: 120,
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_LIGHT,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },
  trendPlaceholder: {
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_MUTED,
    textAlign: "right",
  },
  consistencyText: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: "500",
  },
  dataUsed: {
    fontSize: 10,
    color: TEXT_LIGHT,
    marginTop: 4,
    lineHeight: 14,
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
  },
  sectionSub: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: -6,
    marginBottom: 2,
  },
  observationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  observationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  observationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  observationMeta: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginLeft: 22,
  },
  observationBody: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    marginLeft: 22,
  },
  actionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_LIGHT,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
  },
  actionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
  },
  actionDoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingLeft: 30,
  },
  actionDoText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  targetPill: {
    marginLeft: 30,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: GREEN,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  targetText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 18,
  },
  emptyHint: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontStyle: "italic",
    lineHeight: 18,
  },
});
