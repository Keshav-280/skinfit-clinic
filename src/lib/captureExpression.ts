import type { FaceScanCaptureId } from "@/src/lib/faceScanCaptures";
import type { ExpressionClassifierScores } from "@/src/lib/faceCaptureTypes";
import type { CaptureGuidanceSnapshot } from "@/src/lib/scanCaptureGuidance";

export type FaceBlendshapeCategory = {
  categoryName?: string;
  displayName?: string;
  score?: number;
};

export type ExpressionCalibration = {
  openEarBaseline: number | null;
};

export function needsExpressionCheck(stepId: FaceScanCaptureId): boolean {
  return stepId === "eyes_closed" || stepId === "smiling";
}

function blendScore(
  categories: FaceBlendshapeCategory[] | undefined,
  name: string
): number {
  if (!categories?.length) return 0;
  const key = name.toLowerCase();
  let best = 0;
  for (const c of categories) {
    const n = (c.categoryName ?? c.displayName ?? "").toLowerCase();
    if (n === key || n.endsWith(key) || n.includes(key)) {
      best = Math.max(best, Number(c.score ?? 0));
    }
  }
  return best;
}

function eyeEar(
  landmarks: Array<{ x: number; y: number }>,
  p1: number,
  p2: number,
  p3: number,
  p4: number,
  p5: number,
  p6: number
): number {
  const d = (a: number, b: number) => {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) return 0;
    return Math.hypot(pa.x - pb.x, pa.y - pb.y);
  };
  const horizontal = d(p1, p4);
  if (horizontal < 1e-5) return 0;
  return (d(p2, p6) + d(p3, p5)) / (2 * horizontal);
}

function meanEyeEar(
  landmarks: Array<{ x: number; y: number }> | undefined
): number | null {
  if (!landmarks || landmarks.length < 300) return null;
  const left = eyeEar(landmarks, 33, 160, 158, 133, 153, 144);
  const right = eyeEar(landmarks, 362, 385, 387, 263, 373, 380);
  if (left <= 0 || right <= 0) return null;
  return (left + right) / 2;
}

function updateOpenEarBaseline(
  calibration: ExpressionCalibration,
  ear: number | null
): void {
  if (ear == null || ear < 0.18) return;
  if (ear > 0.26) {
    calibration.openEarBaseline = Math.max(calibration.openEarBaseline ?? 0, ear);
  }
}

function eyesClosedScore(
  categories: FaceBlendshapeCategory[] | undefined,
  landmarks: Array<{ x: number; y: number }> | undefined,
  calibration: ExpressionCalibration,
  wasOk: boolean
): { ok: boolean; confident: boolean } {
  const blink = Math.max(
    blendScore(categories, "eyeBlinkLeft"),
    blendScore(categories, "eyeBlinkRight")
  );
  const squint = Math.max(
    blendScore(categories, "eyeSquintLeft"),
    blendScore(categories, "eyeSquintRight")
  );
  const ear = meanEyeEar(landmarks);

  if (ear != null) updateOpenEarBaseline(calibration, ear);

  const baseline = calibration.openEarBaseline;
  if (baseline != null && ear != null) {
    const ratio = ear / baseline;
    const closed = wasOk ? ratio < 0.72 : ratio < 0.65;
    if (ratio < 0.85 || ratio > 1.05) {
      return { ok: closed, confident: true };
    }
  }

  if (blink >= 0.08) {
    const closed = wasOk ? blink >= 0.14 : blink >= 0.2;
    return { ok: closed, confident: true };
  }

  if (squint >= 0.15 && ear != null && ear < 0.22) {
    return { ok: true, confident: true };
  }

  if (ear != null) {
    const closed = wasOk ? ear < 0.2 : ear < 0.18;
    const confident = ear < 0.16 || ear > 0.28;
    return { ok: closed, confident };
  }

  return { ok: false, confident: false };
}

export function applyCaptureExpression(
  guidance: CaptureGuidanceSnapshot,
  stepId: FaceScanCaptureId,
  categories: FaceBlendshapeCategory[] | undefined,
  expressionOkRef: { current: boolean | null },
  landmarks?: Array<{ x: number; y: number }>,
  expressionPipelineActive = false,
  calibration?: ExpressionCalibration
): CaptureGuidanceSnapshot {
  const next = { ...guidance };
  const cal: ExpressionCalibration = calibration ?? { openEarBaseline: null };

  if (!needsExpressionCheck(stepId)) {
    return next;
  }

  if (stepId === "eyes_closed") {
    const wasOk = expressionOkRef.current === true;
    const { ok, confident } = eyesClosedScore(categories, landmarks, cal, wasOk);

    if (confident) {
      expressionOkRef.current = ok;
      next.expressionOk = ok;
      next.expressionMessage = ok
        ? "Eyes closed — looks good"
        : "Gently close both eyes";
      if (ok) next.readyToCapture = next.readyToCapture && ok;
    } else if (expressionPipelineActive) {
      next.expressionOk = null;
      next.expressionMessage = "Hold still — checking eyes…";
    }
    return next;
  }

  if (stepId === "smiling") {
    const smile = Math.max(
      blendScore(categories, "mouthSmileLeft"),
      blendScore(categories, "mouthSmileRight"),
      blendScore(categories, "smile"),
      blendScore(categories, "mouthSmile")
    );
    const wasOk = expressionOkRef.current === true;

    if (smile >= 0.06) {
      const ok = wasOk ? smile >= 0.16 : smile >= 0.22;
      expressionOkRef.current = ok;
      next.expressionOk = ok;
      next.expressionMessage = ok ? "Smile — looks good" : "Smile naturally";
      if (ok) next.readyToCapture = next.readyToCapture && ok;
    } else if (expressionPipelineActive) {
      next.expressionOk = null;
      next.expressionMessage = "Hold still — checking smile…";
    }
  }

  return next;
}

const CLASSIFIER_BLINK_CLOSED = 0.55;
const CLASSIFIER_BLINK_CLOSED_STRICT = 0.68;
const CLASSIFIER_SMILE_OK = 0.52;
const CLASSIFIER_SMILE_OK_STRICT = 0.62;

/** Blink/smile ONNX classifier (more stable than blendshape thresholds). */
export function applyCaptureExpressionFromClassifier(
  guidance: CaptureGuidanceSnapshot,
  stepId: FaceScanCaptureId,
  scores: ExpressionClassifierScores | null | undefined,
  expressionOkRef: { current: boolean | null },
  pipelineActive = false
): CaptureGuidanceSnapshot {
  const next = { ...guidance };

  if (!needsExpressionCheck(stepId)) {
    return next;
  }

  if (!scores) {
    if (pipelineActive) {
      next.expressionOk = null;
      next.expressionMessage =
        stepId === "eyes_closed"
          ? "Hold still — checking eyes…"
          : "Hold still — checking smile…";
    }
    return next;
  }

  if (stepId === "eyes_closed") {
    const wasOk = expressionOkRef.current === true;
    const closed = wasOk
      ? scores.blink >= CLASSIFIER_BLINK_CLOSED
      : scores.blink >= CLASSIFIER_BLINK_CLOSED_STRICT;
    expressionOkRef.current = closed;
    next.expressionOk = closed;
    next.expressionMessage = closed
      ? "Eyes closed — looks good"
      : "Gently close both eyes";
    if (closed) next.readyToCapture = next.readyToCapture && closed;
    return next;
  }

  if (stepId === "smiling") {
    const wasOk = expressionOkRef.current === true;
    const ok = wasOk
      ? scores.smile >= CLASSIFIER_SMILE_OK
      : scores.smile >= CLASSIFIER_SMILE_OK_STRICT;
    expressionOkRef.current = ok;
    next.expressionOk = ok;
    next.expressionMessage = ok ? "Smile — looks good" : "Smile naturally";
    if (ok) next.readyToCapture = next.readyToCapture && ok;
  }

  return next;
}
