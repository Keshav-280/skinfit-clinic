import { format } from "date-fns";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import {
  CLINIC_SCORE_UNLOCK,
  patientKaiScoreView,
} from "../../src/lib/clarityGrade";

import {
  DASHBOARD_GREEN,
  DASHBOARD_NAVY,
  dashboardNavyCardShadow,
} from "@/lib/dashboardTheme";

const SUB_CARD_BG = "#E8EFE6";
const VALUE_GREEN = "#1E5E3A";
const MUTED = "#6B7280";
const RING_TRACK = "#D8E6DD";
const NEGATIVE_RED = "#EF4444";

function consistencyLabel(value: number) {
  if (value >= 75) return "Aligned";
  if (value >= 50) return "On Track";
  return "Needs Work";
}

function ConsistencyRing({
  value,
  size = 118,
  strokeWidth = 9,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
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
          stroke={RING_TRACK}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {v > 0 ? (
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
        ) : null}
      </Svg>
      <Text style={[styles.ringValue, { fontSize: Math.round(size * 0.26) }]}>{v}</Text>
    </View>
  );
}

type NavyMetricsCardProps = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful?: boolean;
  latestScanAt: string | null;
  consistencyScore: number;
  scoresUnlocked?: boolean;
  style?: object;
};

export function NavyMetricsCard({
  kaiSkinScore,
  weeklyDeltaScore,
  latestScanAt,
  consistencyScore,
  scoresUnlocked = false,
  style,
}: NavyMetricsCardProps) {
  const v = Math.min(100, Math.max(0, Math.round(consistencyScore)));
  const kai = patientKaiScoreView(kaiSkinScore, scoresUnlocked);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        <View style={styles.leftCol}>
          <View style={styles.subCard}>
            {kai.showLock ? <View style={styles.lockOverlay} /> : null}
            <Text style={styles.subLabel}>kAI Skin Score</Text>
            {kai.showLock ? (
              <View style={styles.lockRow}>
                <Ionicons name="lock-closed" size={24} color="rgba(44,62,107,0.75)" />
                <Text style={styles.lockedPrimary}>{kai.kaiPrimary}</Text>
              </View>
            ) : (
              <Text style={styles.subValue}>{kai.kaiPrimary}</Text>
            )}
            <Text style={styles.subMeta}>{kai.kaiSecondary}</Text>
            <Text style={styles.subMeta}>
              {latestScanAt ? `Updated ${format(new Date(latestScanAt), "MMM d")}` : "No scans yet"}
            </Text>
            {kai.showLock ? (
              <Text style={styles.lockHint} numberOfLines={3}>
                {CLINIC_SCORE_UNLOCK.message}
              </Text>
            ) : null}
          </View>
          <View style={styles.subCard}>
            <Text style={styles.subLabel}>Weekly Progress</Text>
            <Text
              style={[
                styles.subValue,
                weeklyDeltaScore < 0 ? { color: NEGATIVE_RED } : null,
              ]}
            >
              {weeklyDeltaScore >= 0 ? "+" : ""}
              {Math.round(weeklyDeltaScore)}
            </Text>
            <Text style={styles.subMeta}>vs last week</Text>
          </View>
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.consistencyTitle}>WEEKLY CONSISTENCY SCORE</Text>
          <View style={styles.ringWrap}>
            <ConsistencyRing value={consistencyScore} />
          </View>
          <Text style={styles.statusLabel}>{consistencyLabel(v)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DASHBOARD_NAVY,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...dashboardNavyCardShadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  leftCol: {
    flex: 5,
    gap: 10,
    justifyContent: "center",
  },
  subCard: {
    backgroundColor: SUB_CARD_BG,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(232,239,230,0.55)",
  },
  subLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: DASHBOARD_NAVY,
    textAlign: "center",
    lineHeight: 13,
    zIndex: 1,
  },
  lockRow: {
    marginTop: 2,
    alignItems: "center",
    zIndex: 1,
  },
  lockedPrimary: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "800",
    color: "rgba(44,62,107,0.8)",
    textAlign: "center",
    lineHeight: 24,
  },
  subValue: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: "800",
    color: VALUE_GREEN,
    textAlign: "center",
    lineHeight: 30,
    zIndex: 1,
  },
  subMeta: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "500",
    color: MUTED,
    textAlign: "center",
    lineHeight: 11,
    zIndex: 1,
  },
  lockHint: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: "600",
    color: "rgba(44,62,107,0.7)",
    textAlign: "center",
    lineHeight: 11,
    zIndex: 1,
  },
  rightCol: {
    flex: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 8,
  },
  consistencyTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  ringWrap: {
    marginTop: 12,
    alignItems: "center",
  },
  ringValue: {
    position: "absolute",
    fontWeight: "800",
    color: "#fff",
    lineHeight: 36,
  },
  statusLabel: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
});
