/**
 * Shared face capture inference types (web, mobile, server preview API).
 */

export type NormalizedFaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Approximate head pose in degrees (camera-facing user). */
export type HeadPoseDegrees = {
  yaw: number;
  pitch: number;
  roll: number;
};

/** Tiny blink / smile classifier outputs (0–1). */
export type ExpressionClassifierScores = {
  blink: number;
  smile: number;
};

export type FacePreviewInferenceResult = {
  box: NormalizedFaceBox | null;
  pose: HeadPoseDegrees | null;
  expression: ExpressionClassifierScores | null;
  detector: "mediapipe" | "retinaface";
  expressionBackend: "blendshapes" | "classifier";
  /** False when ONNX weights are missing — client should fall back to MediaPipe. */
  detectorAvailable: boolean;
  expressionAvailable: boolean;
  warning?: string;
};
