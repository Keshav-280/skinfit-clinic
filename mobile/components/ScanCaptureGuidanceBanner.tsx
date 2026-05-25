import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";

type Props = {
  guidance: CaptureGuidanceSnapshot | null;
  autoZoomEnabled?: boolean;
};

/** Only shows checks that are actually running — nothing for broken/unloaded pipelines. */
export function ScanCaptureGuidanceBanner({ guidance, autoZoomEnabled }: Props) {
  if (!guidance) return null;

  const rows: Array<{ key: string; ok: boolean; icon: keyof typeof Ionicons.glyphMap; text: string }> =
    [];

  if (guidance.showLightingCheck) {
    const lightingOk =
      guidance.lighting === "good" || guidance.lightingScore >= 55;
    rows.push({
      key: "lighting",
      ok: lightingOk,
      icon: "sunny-outline",
      text: guidance.lightingMessage,
    });
  }

  if (guidance.showFaceCheck) {
    rows.push({
      key: "face",
      ok: guidance.face === "good",
      icon: "scan-outline",
      text: guidance.faceMessage,
    });
  }

  if (guidance.showExpressionCheck && guidance.expressionMessage) {
    rows.push({
      key: "expression",
      ok: guidance.expressionOk === true,
      icon: "happy-outline",
      text: guidance.expressionMessage,
    });
  }

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {rows.map((row) => (
        <GuidanceRow key={row.key} ok={row.ok} icon={row.icon} text={row.text} />
      ))}
      {autoZoomEnabled &&
      guidance.showFaceCheck &&
      guidance.suggestedZoom != null ? (
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
        size={17}
        color={ok ? "#34d399" : "#fbbf24"}
      />
      <Ionicons name={icon} size={15} color="rgba(255,255,255,0.8)" />
      <Text style={[styles.rowText, !ok && styles.rowWarn]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "#fff",
  },
  rowWarn: {
    fontWeight: "600",
    color: "#fde68a",
  },
  hint: {
    textAlign: "center",
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
  },
  ready: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#6ee7b7",
  },
});
