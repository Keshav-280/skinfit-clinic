import { StyleSheet, Text, View } from "react-native";

import {
  CAPTURE_FRAMING_THRESHOLDS,
  captureAutoZoomTargetFill,
  IDEAL_FACE_FILL_MAX,
  IDEAL_FACE_FILL_MIN,
  type CaptureAssistModels,
  type CaptureGuidanceSnapshot,
} from "@/lib/scanCaptureGuidance";

type Props = {
  guidance: CaptureGuidanceSnapshot | null;
  captureZoom: number;
  models?: CaptureAssistModels;
  faceTracked?: boolean;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

function fmtPct(fill: number | null | undefined): string {
  if (fill == null || !Number.isFinite(fill)) return "—";
  return `${(fill * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Set EXPO_PUBLIC_CAPTURE_DEBUG=1 to show (defaults on in dev). */
export function isCaptureDebugEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_CAPTURE_DEBUG;
  if (flag === "0") return false;
  if (flag === "1") return true;
  return __DEV__;
}

export function ScanCaptureDebugOverlay({
  guidance,
  captureZoom,
  models,
  faceTracked,
  extra,
}: Props) {
  if (!isCaptureDebugEnabled()) return null;

  const t = CAPTURE_FRAMING_THRESHOLDS;
  const targetFill = captureAutoZoomTargetFill();
  const area = guidance?.faceFill ?? null;
  const areaOk =
    area != null &&
    area >= IDEAL_FACE_FILL_MIN &&
    area <= IDEAL_FACE_FILL_MAX;

  const lines = [
    `area: ${fmtPct(area)} (${fmtNum(area, 3)})`,
    `ideal: ${fmtPct(IDEAL_FACE_FILL_MIN)}–${fmtPct(IDEAL_FACE_FILL_MAX)}`,
    `small: <${fmtPct(t.tooSmallEnter)} ok≥${fmtPct(t.tooSmallExit)}`,
    `large: >${fmtPct(t.tooLargeEnter)}`,
    `zoom tgt: ${fmtPct(targetFill)}`,
    `face: ${guidance?.face ?? "—"}`,
    `light: ${guidance ? `${guidance.lighting} ${guidance.lightingScore}` : "—"}`,
    `zoom: ${fmtNum(captureZoom, 1)}×`,
    `sugg zoom: ${fmtNum(guidance?.suggestedZoom, 2)}`,
    `ready: ${guidance?.readyToCapture ? "yes" : "no"}`,
    `mediapipe: ${models?.mediapipe ?? "—"}`,
    `in band: ${areaOk ? "yes" : "no"}`,
    `tracked: ${faceTracked ? "yes" : "no"}`,
  ];

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      lines.push(`${k}: ${v == null ? "—" : String(v)}`);
    }
  }

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.title}>Capture debug</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 200,
    left: 8,
    zIndex: 40,
    maxWidth: 200,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  title: {
    color: "#6ee7b7",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  line: {
    color: "#ecfdf5",
    fontSize: 9,
    fontFamily: "Menlo",
    lineHeight: 13,
  },
});
