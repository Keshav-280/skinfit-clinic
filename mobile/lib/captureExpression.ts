import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import type { CaptureGuidanceSnapshot } from "@/lib/scanCaptureGuidance";
import type { FaceBlendshapeCategory } from "@/lib/nativeFaceLandmarkDetection";

export type { ExpressionCalibration } from "../../src/lib/captureExpression";

/** Re-export shared policy: expression / eye-closure detection is off everywhere. */
export function needsExpressionCheck(_stepId?: FaceScanCaptureId): boolean {
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
      needsExpressionCheck(stepId) &&
      expressionPipelineActive &&
      stepId === "eyes_closed",
  };
}
