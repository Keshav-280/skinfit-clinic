/**
 * Face capture guidance backends.
 *
 * **Default web framing:** MediaPipe BlazeFace (bbox) + Face Landmarker (eyes / expression).
 * **Best quality:** server RetinaFace ONNX — set FACE_DETECTOR=retinaface and add
 * `models/capture/retinaface.onnx` (see `npm run capture:setup-models`).
 *
 * Disable client MediaPipe with DISABLE_MEDIAPIPE / NEXT_PUBLIC_DISABLE_MEDIAPIPE (=1).
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

/** Web/mobile: call /api/capture/preview when logged in (RetinaFace if ONNX present). */
export function wantsOptionalServerPreview(): boolean {
  if (
    process.env.NEXT_PUBLIC_CAPTURE_SERVER_PREVIEW === "0" ||
    process.env.EXPO_PUBLIC_CAPTURE_SERVER_PREVIEW === "0"
  ) {
    return false;
  }
  if (
    process.env.NEXT_PUBLIC_CAPTURE_SERVER_PREVIEW === "1" ||
    process.env.EXPO_PUBLIC_CAPTURE_SERVER_PREVIEW === "1"
  ) {
    return true;
  }
  return process.env.NODE_ENV === "development";
}

export function shouldTryServerPreviewOnClient(config: {
  detector: FaceDetectorBackend;
  expression: FaceExpressionBackend;
}): boolean {
  return usesServerFacePreview(config) || wantsOptionalServerPreview();
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

/** Global MediaPipe toggle — on unless explicitly disabled. */
export function isMediapipeEnabled(): boolean {
  if (mediapipeExplicitlyDisabled()) return false;
  if (mediapipeExplicitlyEnabled()) return true;
  return true;
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
