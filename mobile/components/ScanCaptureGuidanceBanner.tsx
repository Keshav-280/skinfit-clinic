import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { CaptureAssistModels, CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";

type Props = {
  guidance: CaptureGuidanceSnapshot | null;
  models: CaptureAssistModels;
  needsExpressionModel?: boolean;
  autoZoomEnabled?: boolean;
  compact?: boolean;
};

function statusIcon(ok: boolean | null) {
  if (ok === true) {
    return <Ionicons name="checkmark-circle" size={17} color="#34d399" />;
  }
  if (ok === false) {
    return <Ionicons name="alert-circle" size={17} color="#fbbf24" />;
  }
  return <View style={styles.pendingDot} />;
}

export function ScanCaptureGuidanceBanner({
  guidance,
  models,
  needsExpressionModel,
  autoZoomEnabled,
  compact,
}: Props) {
  if (!guidance) {
    return (
      <View style={styles.wrap}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Checking lighting & face…</Text>
        </View>
      </View>
    );
  }

  const lightingOk =
    guidance.lighting === "good" || guidance.lightingScore >= 55;
  const faceOk = guidance.face === "good";

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {statusIcon(lightingOk)}
        <Ionicons name="sunny-outline" size={15} color="rgba(255,255,255,0.85)" />
        <Text style={[styles.msg, !lightingOk && styles.msgWarn]} numberOfLines={2}>
          {guidance.lightingMessage}
        </Text>
      </View>
      <View style={styles.row}>
        {statusIcon(faceOk)}
        <Ionicons name="person-outline" size={15} color="rgba(255,255,255,0.85)" />
        <Text style={[styles.msg, !faceOk && styles.msgWarn]} numberOfLines={2}>
          {guidance.faceMessage}
        </Text>
      </View>
      {needsExpressionModel || guidance.expressionMessage ? (
        <View style={styles.row}>
          {statusIcon(guidance.expressionOk)}
          <Text style={[styles.msg, guidance.expressionOk !== true && styles.msgWarn]} numberOfLines={2}>
            {guidance.expressionMessage ??
              (models.mediapipe === "loading"
                ? "Loading expression model…"
                : "Hold still — checking expression…")}
          </Text>
        </View>
      ) : null}
      {autoZoomEnabled && guidance.suggestedZoom != null ? (
        <Text style={styles.hint}>Auto zoom…</Text>
      ) : null}
      {guidance.readyToCapture ? (
        <Text style={styles.ready}>Ready to capture</Text>
      ) : null}
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  pendingDot: {
    marginTop: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  msg: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "#fff",
  },
  msgWarn: {
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
