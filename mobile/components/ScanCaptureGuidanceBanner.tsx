import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";

const NAVY = "#2C3E6B";

type Props = {
  guidance: CaptureGuidanceSnapshot | null;
  analyzing?: boolean;
  autoZoomEnabled?: boolean;
};

export function ScanCaptureGuidanceBanner({
  guidance,
  analyzing,
  autoZoomEnabled,
}: Props) {
  if (!guidance) {
    return (
      <View style={styles.wrap}>
        {analyzing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : null}
        <Text style={styles.pending}>
          Checking lighting and face position…
        </Text>
      </View>
    );
  }

  const lightingOk =
    guidance.lighting === "good" || guidance.lightingScore >= 55;
  const faceOk = guidance.face === "good";

  return (
    <View style={styles.wrap}>
      <GuidanceRow
        ok={lightingOk}
        icon="sunny-outline"
        text={guidance.lightingMessage}
      />
      <GuidanceRow
        ok={faceOk}
        icon="person-outline"
        text={guidance.faceMessage}
      />
      {autoZoomEnabled && guidance.suggestedZoom != null ? (
        <Text style={styles.hint}>Auto-adjusting zoom…</Text>
      ) : null}
      {guidance.readyToCapture ? (
        <Text style={styles.ready}>Ready — hold steady and capture</Text>
      ) : null}
    </View>
  );
}

function GuidanceRow({
  ok,
  icon,
  text,
}: {
  ok: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons
        name={ok ? "checkmark-circle" : "alert-circle"}
        size={18}
        color={ok ? "#34d399" : "#fbbf24"}
      />
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.85)" />
      <Text style={[styles.rowText, !ok && styles.rowWarn]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  pending: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  rowText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: "#fff",
  },
  rowWarn: {
    fontWeight: "600",
    color: "#fde68a",
  },
  hint: {
    textAlign: "center",
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },
  ready: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#6ee7b7",
  },
});
