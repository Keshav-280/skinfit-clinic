import { StyleSheet, Text, View } from "react-native";

import {
  CLARITY_GRADES_ASCENDING,
  patientChartDisplayValue,
  patientClarityToGrade,
} from "../../src/lib/clarityGrade";

const NAVY = "#2C3E6B";

function valueForBar(n: number | null) {
  if (typeof n !== "number") return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

type Props = {
  value: number | null;
  scoresUnlocked: boolean;
  width?: number;
};

export function ParamScoreBarNative({
  value,
  scoresUnlocked,
  width = 72,
}: Props) {
  if (!scoresUnlocked) {
    const active =
      typeof value === "number" ? patientClarityToGrade(value) : null;
    return (
      <View
        style={[styles.checkpointTrack, { width }]}
        accessibilityRole="image"
        accessibilityLabel={
          active ? `Grade ${active} (locked overview)` : "Grade checkpoints"
        }
      >
        {CLARITY_GRADES_ASCENDING.map((grade) => {
          const on = grade === active;
          return (
            <View
              key={grade}
              style={[styles.checkpoint, on && styles.checkpointOn]}
            >
              <Text
                style={[styles.checkpointText, on && styles.checkpointTextOn]}
                numberOfLines={1}
              >
                {grade}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  const pct =
    typeof value === "number"
      ? valueForBar(patientChartDisplayValue(value, true))
      : 0;
  const displayScore =
    typeof value === "number"
      ? Math.round(patientChartDisplayValue(value, true))
      : null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, width }}>
      <View style={[styles.barTrack, { flex: 1 }]}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.scoreText}>
        {displayScore !== null ? String(displayScore) : "–"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  checkpointTrack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(44,62,107,0.1)",
    paddingHorizontal: 2,
  },
  checkpoint: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 1,
  },
  checkpointOn: {
    backgroundColor: NAVY,
  },
  checkpointText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#a1a1aa",
  },
  checkpointTextOn: {
    color: "#fff",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(44,62,107,0.12)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: NAVY,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
    minWidth: 20,
    textAlign: "right",
  },
});
