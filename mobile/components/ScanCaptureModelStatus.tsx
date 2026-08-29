import { StyleSheet, Text, View } from "react-native";

import { needsMediapipeOnClient, getMobileFaceCaptureConfig } from "@/lib/faceCaptureConfig";
import type { CaptureAssistModels } from "@/lib/scanCaptureGuidance";

const NAVY = "#1E1B31";

type Props = {
  models: CaptureAssistModels;
  compact?: boolean;
  needsExpressionModel?: boolean;
};

function ModelLine({
  label,
  state,
  detail,
  compact,
}: {
  label: string;
  state: "ok" | "warn" | "muted" | "loading";
  detail: string;
  compact?: boolean;
}) {
  const dotColor =
    state === "ok"
      ? "#10b981"
      : state === "warn"
        ? "#f59e0b"
        : state === "loading"
          ? NAVY
          : "#9CA3AF";
  const textColor =
    state === "ok"
      ? NAVY
      : state === "warn"
        ? "#92400e"
        : state === "loading"
          ? NAVY
          : "#6B7280";

  return (
    <View style={styles.line}>
      <View style={styles.lineHead}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.lineLabel, compact && styles.lineLabelCompact, { color: textColor }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.lineDetail, compact && styles.lineDetailCompact]}>{detail}</Text>
    </View>
  );
}

export function ScanCaptureModelStatus({
  models,
  compact,
  needsExpressionModel,
}: Props) {
  const mpEnabled = needsMediapipeOnClient(getMobileFaceCaptureConfig());
  const textSize = compact ? 10 : 11;

  let mpState: "ok" | "warn" | "muted" | "loading" = "muted";
  let mpDetail = "not started";
  switch (models.mediapipe) {
    case "loading":
      mpState = "loading";
      mpDetail = "loading…";
      break;
    case "ready":
      mpState = "ok";
      mpDetail = "native face mesh";
      break;
    case "failed":
      mpState = "warn";
      mpDetail = models.mediapipeError ?? "failed";
      break;
    default:
      mpDetail = models.mediapipe === "off" ? "off" : "waiting";
  }

  let rfState: "ok" | "warn" | "muted" | "loading" = "muted";
  let rfDetail = "off";
  if (models.retinaface !== "off") {
    switch (models.retinaface) {
      case "loading":
        rfState = "loading";
        rfDetail = "server…";
        break;
      case "ready":
        rfState = "ok";
        rfDetail = "RetinaFace";
        break;
      case "failed":
        rfState = "warn";
        rfDetail = models.retinafaceError ?? "unavailable";
        break;
      default:
        rfDetail = "waiting";
    }
  }

  let clfState: "ok" | "warn" | "muted" = "muted";
  let clfDetail = "off";
  if (models.expressionClassifier !== "off") {
    if (models.expressionClassifier === "ready") {
      clfState = "ok";
      clfDetail = "blink classifier";
    } else if (models.expressionClassifier === "failed") {
      clfState = "warn";
      clfDetail = "unavailable";
    } else {
      clfDetail = "waiting";
    }
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Capture assistant models">
      <Text style={[styles.title, { fontSize: textSize }]}>Capture AI</Text>
      <View style={styles.grid}>
        {mpEnabled && models.mediapipe !== "off" ? (
          <ModelLine label="MediaPipe" state={mpState} detail={mpDetail} compact={compact} />
        ) : null}
        {models.retinaface !== "off" ? (
          <ModelLine label="RetinaFace" state={rfState} detail={rfDetail} compact={compact} />
        ) : null}
        {models.expressionClassifier !== "off" ? (
          <ModelLine
            label="Expression"
            state={clfState}
            detail={clfDetail}
            compact={compact}
          />
        ) : null}
      </View>
      {mpEnabled && needsExpressionModel && models.mediapipe === "failed" ? (
        <Text style={[styles.warn, { fontSize: textSize }]}>
          Rebuild the app with the face landmarker model asset.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(30, 27, 49,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  title: {
    marginBottom: 4,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#9CA3AF",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  line: { minWidth: "30%", flexGrow: 1 },
  lineHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  lineLabel: { fontSize: 11, fontWeight: "700" },
  lineLabelCompact: { fontSize: 10 },
  lineDetail: {
    marginTop: 2,
    marginLeft: 10,
    fontSize: 10,
    color: "#9CA3AF",
    lineHeight: 13,
  },
  lineDetailCompact: { fontSize: 9 },
  warn: {
    marginTop: 6,
    fontWeight: "600",
    color: "#fde68a",
  },
});
