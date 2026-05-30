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
  /** Safe-area top offset so the panel clears the header/instruction card. */
  insetTop?: number;
  extra?: Record<string, string | number | boolean | null | undefined>;
  /** Explicit on-screen toggle — overrides the env/dev default when provided. */
  visible?: boolean;
};

function fmtPct(fill: number | null | undefined): string {
  if (fill == null || !Number.isFinite(fill)) return "—";
  return `${(fill * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Dev default on; set EXPO_PUBLIC_CAPTURE_DEBUG=0 to hide, =1 to force on in release. */
export function isCaptureDebugEnabled(): boolean {
  const previewFlag = process.env.EXPO_PUBLIC_SCAN_DEBUG_PREVIEW?.trim();
  if (previewFlag === "1" || previewFlag === "true") return true;
  const flag = process.env.EXPO_PUBLIC_CAPTURE_DEBUG?.trim();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";
}

export function ScanCaptureDebugOverlay({
  guidance,
  captureZoom,
  models,
  faceTracked,
  insetTop = 0,
  extra,
  visible,
}: Props) {
  const show = visible ?? isCaptureDebugEnabled();
  if (!show) return null;

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
    <View style={[styles.wrap, { top: insetTop + 8 }]} pointerEvents="none">
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
    left: 8,
    zIndex: 100,
    elevation: 100,
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
