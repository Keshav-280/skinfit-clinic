import { Platform, StyleSheet, Text, View } from "react-native";

import type { PatientTrackerReport } from "@/lib/patientTrackerReport.types";
import { TRACKER_REPORT_THEME as R } from "@/lib/scanReportTheme";

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function deltaColor(n: number) {
  if (n > 0) return R.deltaUp;
  if (n < 0) return R.deltaDown;
  return "#71717a";
}

function causeDotColor(impact: "high" | "medium" | "low") {
  if (impact === "high") return R.causeHigh;
  if (impact === "medium") return R.causeMed;
  return R.causeLow;
}

function valueForBar(n: number | null) {
  if (typeof n !== "number") return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseFocusDetail(detail: string): Array<{ label: string; body: string }> {
  return detail
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(Why|Do|Target):\s*(.*)$/i);
      if (!m) return { label: "", body: line };
      return { label: `${m[1]}:`, body: m[2] ?? "" };
    });
}

type Props = {
  report: PatientTrackerReport;
  serifFamily: string;
};

export function TrackerReportSectionsNative({ report, serifFamily }: Props) {
  const { lastScanDelta, weekAverageDelta } = report.scores;
  const isOnboardingBaseline = report.scanContext.kind === "onboarding_first_scan";

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.sectionKicker}>Section 1</Text>
        <Text style={[styles.hookTitle, { fontFamily: serifFamily }]}>{report.hookSentence}</Text>
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
        <Text style={styles.comparisonHint}>{report.insightText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionKicker}>Section 2 </Text>
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
                    { backgroundColor: causeDotColor(cause.impact) },
                  ]}
                />
                <Text style={styles.causeText}>{cause.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.overviewPara}>{report.predictionText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionKicker}>
          {isOnboardingBaseline ? "Getting started" : "Section 3"}
        </Text>
        {isOnboardingBaseline ? (
          <Text style={styles.onboardingFocusIntro}>
            Follow these habits over the next week — your first scan is the starting point, not a
            comparison.
          </Text>
        ) : null}
        <View style={{ marginTop: 10, gap: 10 }}>
          {report.focusActions.slice(0, 3).map((a) => (
            <View key={a.rank} style={styles.focusCard}>
              <View style={styles.focusRank}>
                <Text style={styles.focusRankText}>{a.rank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.focusTitle}>{a.title}</Text>
                {parseFocusDetail(a.detail).map((part, idx) => (
                  <Text key={`${a.rank}-${idx}`} style={styles.focusDetail}>
                    {part.label ? <Text style={styles.focusDetailLabel}>{part.label} </Text> : null}
                    {part.body}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const NAVY = R.navy;
const CARD_BORDER = R.cardBorder;
const CARD_BG = "#FFFFFF";

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#2C3E6B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  wrap: { gap: 16, marginTop: 8 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...cardShadow,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: NAVY,
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
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: NAVY,
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
    color: "#6B7280",
  },
  blockTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(248, 251, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  insetBox: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(248, 251, 255, 0.95)",
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
    color: "#374151",
  },
  paramBarTrack: {
    width: 72,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(44,62,107,0.12)",
    overflow: "hidden",
  },
  paramBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3d5080",
  },
  paramNum: {
    width: 28,
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
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
  causeText: { flex: 1, fontSize: 13, lineHeight: 20, color: "#374151" },
  overviewPara: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 22,
    color: "#6B7280",
  },
  onboardingFocusIntro: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
  },
  focusCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(248, 251, 255, 0.95)",
    padding: 12,
  },
  focusRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(44,62,107,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  focusRankText: { fontSize: 14, fontWeight: "800", color: NAVY },
  focusTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  focusDetail: { marginTop: 6, fontSize: 13, lineHeight: 20, color: "#6B7280" },
  focusDetailLabel: { fontWeight: "700", color: "#334155" },
});
