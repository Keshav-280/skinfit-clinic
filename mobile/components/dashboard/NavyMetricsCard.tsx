import { format } from "date-fns";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import {
  DASHBOARD_GREEN,
  DASHBOARD_NAVY,
  dashboardNavyCardShadow,
} from "@/lib/dashboardTheme";

const NAVY_TRACK = "rgba(255,255,255,0.22)";
const SALMON = "#FCA5A5";

function consistencyLabel(value: number) {
  if (value >= 75) return "Aligned";
  if (value >= 50) return "On Track";
  return "Needs Work";
}

function ConsistencyRing({ value, size = 100 }: { value: number; size?: number }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v / 100);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={NAVY_TRACK}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={DASHBOARD_GREEN}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.ringValue}>{v}</Text>
    </View>
  );
}

type NavyMetricsCardProps = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  latestScanAt: string | null;
  consistencyScore: number;
  style?: object;
};

export function NavyMetricsCard({
  kaiSkinScore,
  weeklyDeltaScore,
  latestScanAt,
  consistencyScore,
  style,
}: NavyMetricsCardProps) {
  const v = Math.min(100, Math.max(0, Math.round(consistencyScore)));
  const statusColor = v >= 50 ? DASHBOARD_GREEN : SALMON;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.scoresRow}>
        <View style={styles.scoreCol}>
          <Text style={styles.label}>kAI Skin Score</Text>
          <Text style={styles.value}>{kaiSkinScore}</Text>
          <Text style={styles.sub}>
            {latestScanAt ? `Updated ${format(new Date(latestScanAt), "MMM d")}` : "No scans yet"}
          </Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={styles.label}>Weekly Progress</Text>
          <Text
            style={[
              styles.value,
              weeklyDeltaScore < 0 ? { color: SALMON } : null,
            ]}
          >
            {weeklyDeltaScore >= 0 ? "+" : ""}
            {Math.round(weeklyDeltaScore)}
          </Text>
          <Text style={styles.sub}>vs last week</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.consistencySection}>
        <Text style={styles.consistencyTitle}>WEEKLY CONSISTENCY SCORE</Text>
        <View style={styles.ringWrap}>
          <ConsistencyRing value={consistencyScore} />
        </View>
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {consistencyLabel(v)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DASHBOARD_NAVY,
    borderRadius: 20,
    padding: 20,
    flexDirection: "column",
    ...dashboardNavyCardShadow,
  },
  scoresRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  scoreCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  value: {
    marginTop: 4,
    fontSize: 36,
    fontWeight: "800",
    color: DASHBOARD_GREEN,
    textAlign: "center",
    lineHeight: 40,
  },
  sub: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  divider: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  consistencySection: {
    paddingTop: 20,
    alignItems: "center",
  },
  consistencyTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  ringWrap: {
    marginTop: 12,
    marginBottom: 4,
    alignItems: "center",
  },
  ringValue: {
    position: "absolute",
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  statusLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
