import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import type { PatientTrackerReport } from "@/lib/patientTrackerReport.types";

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function deltaColor(n: number) {
  if (n > 0) return "#047857";
  if (n < 0) return "#be123c";
  return "#52525b";
}

function valueForBar(n: number | null) {
  if (typeof n !== "number") return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function weekSentence(report: PatientTrackerReport) {
  const primary =
    report.scores.deltaMode === "week_average"
      ? report.scores.weekAverageDelta
      : report.scores.lastScanDelta;
  if (typeof primary !== "number") return "Baseline week captured. Build consistency now.";
  if (primary >= 4) return "Your skin improved this week.";
  if (primary <= -4) return "Tough week - here's why.";
  return "Steady week - now let's unlock better gains.";
}

function kindBadge(kind: "article" | "video" | "insight") {
  if (kind === "article") return "Article";
  if (kind === "video") return "Video";
  return "kAI insight";
}

type Props = {
  report: PatientTrackerReport;
  serifFamily: string;
};

export function TrackerReportSectionsNative({ report, serifFamily }: Props) {
  const { lastScanDelta, weekAverageDelta } = report.scores;
  const plainOverview =
    report.scanContext.kind === "onboarding_first_scan"
      ? "This is your baseline. Next scans become more accurate as routine data builds."
      : report.hookSentence;

  const comparisonLine =
    typeof report.scores.weekAverageDelta === "number" &&
    report.scores.currentWeekAverageKai != null &&
    report.scores.previousWeekAverageKai != null
      ? `Weekly comparison: this week avg ${report.scores.currentWeekAverageKai} vs previous week avg ${report.scores.previousWeekAverageKai} (${signed(report.scores.weekAverageDelta)}).`
      : typeof report.scores.lastScanDelta === "number"
        ? `Weekly comparison unavailable yet. Last scan comparison: ${signed(report.scores.lastScanDelta)} vs previous scan.`
        : "Weekly comparison unavailable yet. Take another scan in a different week to unlock it.";

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.sectionKicker}>Section 1 — Hook</Text>
        <Text style={[styles.hookTitle, { fontFamily: serifFamily }]}>{weekSentence(report)}</Text>
        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>kAI score</Text>
            <Text style={styles.statValue}>{report.scores.kaiScore}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Weekly delta</Text>
            <Text style={styles.statValue}>
              {typeof weekAverageDelta === "number" ? (
                <Text style={{ color: deltaColor(weekAverageDelta) }}>
                  {signed(weekAverageDelta)}
                </Text>
              ) : typeof lastScanDelta === "number" ? (
                <Text style={{ color: deltaColor(lastScanDelta) }}>{signed(lastScanDelta)}</Text>
              ) : (
                <Text style={{ color: "#71717a" }}>-</Text>
              )}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Consistency</Text>
            <Text style={styles.statValue}>{report.scores.consistencyScore}%</Text>
          </View>
        </View>
        <Text style={styles.comparisonHint}>{comparisonLine}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionKicker}>Section 2 — Feel understood</Text>
        <Text style={styles.blockTitle}>Your skin type</Text>
        <View style={styles.pillRow}>
          {report.skinPills.slice(0, 3).map((pill) => (
            <View key={pill} style={styles.pill}>
              <Text style={styles.pillText}>{pill}</Text>
            </View>
          ))}
        </View>

        <View style={styles.insetBox}>
          <Text style={styles.blockTitle}>This week&apos;s overview</Text>
          <View style={{ marginTop: 10, gap: 10 }}>
            {report.paramRows.slice(0, 8).map((row) => (
              <View key={row.key} style={styles.paramRow}>
                <Text style={styles.paramLabel} numberOfLines={2}>
                  {row.label}
                </Text>
                <View style={styles.paramBarTrack}>
                  <View
                    style={[styles.paramBarFill, { width: `${valueForBar(row.value)}%` }]}
                  />
                </View>
                <Text style={styles.paramNum}>{row.value ?? "-"}</Text>
                <Text
                  style={[
                    styles.paramDelta,
                    typeof row.delta === "number" ? { color: deltaColor(row.delta) } : { color: "#a1a1aa" },
                  ]}
                >
                  {typeof row.delta === "number" ? signed(row.delta) : "-"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.insetBox, { marginTop: 14 }]}>
          <Text style={styles.blockTitle}>Why your skin behaves this way</Text>
          <View style={{ marginTop: 10, gap: 10 }}>
            {report.causes.slice(0, 3).map((cause, idx) => (
              <View key={`${cause.text}-${idx}`} style={styles.causeRow}>
                <View
                  style={[
                    styles.causeDot,
                    {
                      backgroundColor:
                        cause.impact === "high"
                          ? "#d97706"
                          : cause.impact === "medium"
                            ? "#0d9488"
                            : "#0284c7",
                    },
                  ]}
                />
                <Text style={styles.causeText}>{cause.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.overviewPara}>{plainOverview}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionKicker}>Section 3 — Resource centre</Text>
        <View style={{ marginTop: 8, gap: 10 }}>
          {report.resources.slice(0, 3).map((r) => (
            <Text
              key={r.url}
              style={styles.resourceLink}
              onPress={() => void Linking.openURL(r.url)}
            >
              {r.title}
              {"\n"}
              <Text style={styles.resourceMeta}>
                {kindBadge(r.kind)} · personalized pick
              </Text>
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionKicker}>Section 4 — This week&apos;s focus</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          {report.focusActions.slice(0, 3).map((a) => (
            <View key={a.rank} style={styles.focusCard}>
              <View style={styles.focusRank}>
                <Text style={styles.focusRankText}>{a.rank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.focusTitle}>{a.title}</Text>
                <Text style={styles.focusDetail}>{a.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, marginTop: 8 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "rgba(255,253,249,0.98)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: "#5a482d",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#71717a",
    textTransform: "uppercase",
  },
  hookTitle: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "500",
    color: "#18181b",
    lineHeight: 34,
  },
  statGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  statCell: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EDE7DC",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statValue: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: "700",
    color: "#18181b",
  },
  comparisonHint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: "#52525b",
  },
  blockTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#18181b",
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6DFD4",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: "#3f3f46" },
  insetBox: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAE4DA",
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 14,
  },
  paramRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  paramLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: "600",
    color: "#3f3f46",
  },
  paramBarTrack: {
    width: 72,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#ECEAE4",
    overflow: "hidden",
  },
  paramBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0d9488",
  },
  paramNum: {
    width: 28,
    fontSize: 11,
    fontWeight: "700",
    color: "#18181b",
    textAlign: "right",
  },
  paramDelta: {
    width: 36,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  causeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  causeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: Platform.OS === "ios" ? 6 : 7,
  },
  causeText: { flex: 1, fontSize: 13, lineHeight: 20, color: "#3f3f46" },
  overviewPara: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 22,
    color: "#52525b",
  },
  resourceLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f766e",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAE4DA",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  resourceMeta: {
    fontSize: 11,
    fontWeight: "500",
    color: "#71717a",
    marginTop: 4,
  },
  focusCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAE4DA",
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 12,
  },
  focusRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  focusRankText: { fontSize: 14, fontWeight: "800", color: "#047857" },
  focusTitle: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  focusDetail: { marginTop: 6, fontSize: 13, lineHeight: 20, color: "#52525b" },
});
