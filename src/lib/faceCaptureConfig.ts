/**
 * Face capture guidance backends.
 *
 * MediaPipe is **off by default**. Enable with ENABLE_MEDIAPIPE / NEXT_PUBLIC_ENABLE_MEDIAPIPE /
 * EXPO_PUBLIC_ENABLE_MEDIAPIPE (=1). Legacy disable flags still honored.
 *
 * Web: NEXT_PUBLIC_FACE_DETECTOR, NEXT_PUBLIC_FACE_EXPRESSION
 * Mobile: EXPO_PUBLIC_FACE_DETECTOR, EXPO_PUBLIC_FACE_EXPRESSION
 * Server: FACE_DETECTOR, FACE_EXPRESSION, CAPTURE_PREVIEW_PYTHON
 */

export type FaceDetectorBackend = "mediapipe" | "retinaface";
export type FaceExpressionBackend = "blendshapes" | "classifier";

function parseDetector(raw: string | undefined): FaceDetectorBackend {
  const v = raw?.trim().toLowerCase();
  return v === "retinaface" ? "retinaface" : "mediapipe";
}

function parseExpression(raw: string | undefined): FaceExpressionBackend {
  const v = raw?.trim().toLowerCase();
  return v === "classifier" ? "classifier" : "blendshapes";
}

/** Server / API route (Node). */
export function getServerFaceCaptureConfig() {
  return {
    detector: parseDetector(process.env.FACE_DETECTOR),
    expression: parseExpression(process.env.FACE_EXPRESSION),
    previewPython:
      process.env.CAPTURE_PREVIEW_PYTHON?.trim() || "python3",
    modelsDir:
      process.env.FACE_CAPTURE_MODELS_DIR?.trim() ||
      "models/capture",
  };
}

/** Browser (Next.js client). */
export function getWebFaceCaptureConfig() {
  return {
    detector: parseDetector(process.env.NEXT_PUBLIC_FACE_DETECTOR),
    expression: parseExpression(process.env.NEXT_PUBLIC_FACE_EXPRESSION),
  };
}

/** Expo / React Native. */
export function getMobileFaceCaptureConfig() {
  return {
    detector: parseDetector(process.env.EXPO_PUBLIC_FACE_DETECTOR),
    expression: parseExpression(process.env.EXPO_PUBLIC_FACE_EXPRESSION),
  };
}

export function usesServerFacePreview(config: {
  detector: FaceDetectorBackend;
  expression: FaceExpressionBackend;
}): boolean {
  return (
    config.detector === "retinaface" || config.expression === "classifier"
  );
}

function mediapipeExplicitlyEnabled(): boolean {
  return (
    process.env.ENABLE_MEDIAPIPE === "1" ||
    process.env.NEXT_PUBLIC_ENABLE_MEDIAPIPE === "1" ||
    process.env.EXPO_PUBLIC_ENABLE_MEDIAPIPE === "1"
  );
}

function mediapipeExplicitlyDisabled(): boolean {
  return (
    process.env.DISABLE_MEDIAPIPE === "1" ||
    process.env.NEXT_PUBLIC_DISABLE_MEDIAPIPE === "1" ||
    process.env.NEXT_PUBLIC_DISABLE_WEB_MEDIAPIPE === "1" ||
    process.env.EXPO_PUBLIC_DISABLE_MEDIAPIPE === "1"
  );
}

/** Global MediaPipe kill-switch — default off. */
export function isMediapipeEnabled(): boolean {
  if (mediapipeExplicitlyEnabled()) return true;
  if (mediapipeExplicitlyDisabled()) return false;
  return false;
}

export function needsMediapipeOnClient(config: {
  detector: FaceDetectorBackend;
  expression: FaceExpressionBackend;
}): boolean {
  if (!isMediapipeEnabled()) return false;
  if (config.detector === "mediapipe") return true;
  if (config.expression === "blendshapes") return true;
  return false;
}
