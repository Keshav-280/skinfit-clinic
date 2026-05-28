import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";

const NAVY = "#2C3E6B";

type Props = {
  completedCount: number;
  compact?: boolean;
};

export function ScanCaptureStepTicks({ completedCount, compact }: Props) {
  const current = Math.min(completedCount, FACE_SCAN_CAPTURE_STEPS.length - 1);

  return (
    <View style={[styles.row, compact && styles.rowCompact]} accessibilityLabel="Scan step progress">
      {FACE_SCAN_CAPTURE_STEPS.map((step, i) => {
        const done = i < completedCount;
        const active = i === current && !done;
        return (
          <View
            key={step.id}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              done && styles.chipDone,
              active && styles.chipActive,
            ]}
            accessibilityLabel={step.title}
          >
            <Ionicons
              name={done ? "checkmark-circle" : "ellipse-outline"}
              size={compact ? 12 : 14}
              color={done ? "#059669" : active ? NAVY : "#9CA3AF"}
            />
            <Text
              style={[
                styles.num,
                compact && styles.numCompact,
                done && styles.numDone,
                active && styles.numActive,
              ]}
            >
              {i + 1}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  rowCompact: { gap: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  chipDone: {
    borderColor: "rgba(16,185,129,0.45)",
    backgroundColor: "rgba(16,185,129,0.18)",
  },
  chipActive: {
    borderColor: "rgba(44,62,107,0.5)",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  num: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  numCompact: { fontSize: 10 },
  numDone: { color: "#065f46" },
  numActive: { color: NAVY },
});
