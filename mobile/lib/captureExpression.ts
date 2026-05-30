import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import type { CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";
import type { FaceBlendshapeCategory } from "@/lib/nativeFaceLandmarkDetection";

export type { ExpressionCalibration } from "../../src/lib/captureExpression";

/**
 * Eye-closure (and any expression) detection is intentionally DISABLED on the
 * phone app. On-device MediaPipe is usually unavailable and the server blink
 * classifier produced noisy "Gently close both eyes" nagging that annoyed users
 * without ever blocking capture. The "eyes closed" capture step still exists —
 * we just don't run live detection or guidance for it on mobile.
 */
export function needsExpressionCheck(): boolean {
  return false;
}

import {
  applyCaptureExpression as applyCaptureExpressionBase,
  applyCaptureExpressionFromClassifier,
  type ExpressionCalibration,
} from "../../src/lib/captureExpression";

export { applyCaptureExpressionFromClassifier };

export function applyCaptureExpression(
  guidance: CaptureGuidanceSnapshot,
  stepId: FaceScanCaptureId,
  categories: FaceBlendshapeCategory[] | undefined,
  expressionOkRef: { current: boolean | null },
  landmarks?: Array<{ x: number; y: number }>,
  expressionPipelineActive = false,
  calibration?: ExpressionCalibration
): CaptureGuidanceSnapshot {
  const next = applyCaptureExpressionBase(
    guidance,
    stepId,
    categories,
    expressionOkRef,
    landmarks,
    expressionPipelineActive,
    calibration
  );
  return {
    ...next,
    showExpressionCheck:
      expressionPipelineActive &&
      stepId === "eyes_closed",
  };
}
