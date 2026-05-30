import { decode } from "jpeg-js";
import { Buffer } from "buffer";
import * as ImageManipulator from "expo-image-manipulator";

import {
  applyCaptureExpression,
  applyCaptureExpressionFromClassifier,
  needsExpressionCheck,
  type ExpressionCalibration,
} from "@/lib/captureExpression";
import {
  getMobileFaceCaptureConfig,
  needsMediapipeOnClient,
  shouldTryServerPreviewOnClient,
  usesServerFacePreview,
} from "@/lib/faceCaptureConfig";
import { fetchFacePreviewInference } from "@/lib/fetchFacePreviewInference";
import { detectFaceLandmarksForPreview } from "@/lib/detectFaceLandmarksForPreview";
import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import {
  analyzeFaceFraming,
  analyzeLightingFromRgba,
  buildCaptureGuidance,
  estimateFaceBoxFromSkin,
  faceBoxFromLandmarkPoints,
  smoothFaceBox,
  type CaptureGuidanceSnapshot,
  type NormalizedFaceBox,
  type StableFramingState,
} from "@/lib/scanCaptureGuidance";

const PREVIEW_WIDTH = 240;
/** Faster bbox/area tracking on device preview ticks. */
const MOBILE_PREVIEW_SMOOTH_ALPHA = 0.32;
/** Higher-res still for MediaPipe (eyes / smile need detail). */
const LANDMARK_PREVIEW_WIDTH = 512;

export type PreviewGuidanceState = {
  smoothedBox: NormalizedFaceBox | null;
  framing: StableFramingState | null;
  expressionCalibration: ExpressionCalibration;
  faceLandmarks: Array<{ x: number; y: number }> | null;
};

export type AnalyzePreviewOptions = {
  stepId: FaceScanCaptureId;
  landmarkDetectionEnabled: boolean;
  expressionOkRef: { current: boolean | null };
  authToken?: string | null;
};

export async function analyzePreviewImageUri(
  uri: string,
  currentZoom: number,
  state?: PreviewGuidanceState,
  options?: AnalyzePreviewOptions
): Promise<{
  guidance: CaptureGuidanceSnapshot | null;
  state: PreviewGuidanceState;
  meta?: {
    bboxSource: string;
    landmarkPipelineActive: boolean;
    serverDetectorUsed: boolean;
    expressionClassifierUsed: boolean;
  };
}> {
  const expressionStep = options ? needsExpressionCheck(options.stepId) : false;
  const captureCfg = getMobileFaceCaptureConfig();
  const useServer =
    usesServerFacePreview(captureCfg) ||
    shouldTryServerPreviewOnClient(captureCfg) ||
    Boolean(options?.authToken);
  const needsMp = needsMediapipeOnClient(captureCfg);

  const [small, landmarkSized] = await Promise.all([
    ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: PREVIEW_WIDTH } }],
      {
        compress: 0.55,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    ),
    options?.landmarkDetectionEnabled && needsMp
      ? ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: LANDMARK_PREVIEW_WIDTH } }],
          {
            compress: 0.72,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        )
      : Promise.resolve(null),
  ]);

  const emptyState: PreviewGuidanceState = {
    smoothedBox: state?.smoothedBox ?? null,
    framing: state?.framing ?? null,
    expressionCalibration: state?.expressionCalibration ?? { openEarBaseline: null },
    faceLandmarks: state?.faceLandmarks ?? null,
  };
  if (!small.base64) {
    return { guidance: null, state: emptyState, meta: { bboxSource: "—", landmarkPipelineActive: false, serverDetectorUsed: false, expressionClassifierUsed: false } };
  }

  const buf = Buffer.from(small.base64, "base64");
  const decoded = decode(buf, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = decoded;
  if (!width || !height) {
    return { guidance: null, state: emptyState, meta: { bboxSource: "—", landmarkPipelineActive: false, serverDetectorUsed: false, expressionClassifierUsed: false } };
  }

  const lighting = analyzeLightingFromRgba(data, width, height);

  let rawBox: NormalizedFaceBox | null = null;
  let landmarkBox: NormalizedFaceBox | null = null;
  let bboxSource = "—";
  let blendCategories: { categoryName?: string; score: number }[] | undefined;
  let landmarkPoints: Array<{ x: number; y: number }> | undefined;
  const landmarkPipelineActive =
    Boolean(options?.landmarkDetectionEnabled) && needsMp;

  let serverPreview: Awaited<ReturnType<typeof fetchFacePreviewInference>> = null;
  if (useServer && options?.authToken) {
    const previewUri = landmarkSized?.uri ?? small.uri ?? uri;
    serverPreview = await fetchFacePreviewInference(options.authToken, previewUri);
  }

  const landmarkUri = landmarkSized?.uri ?? small.uri ?? uri;
  if (landmarkPipelineActive) {
    const mp = await detectFaceLandmarksForPreview(landmarkUri);
    landmarkPoints = mp?.results?.[0]?.faceLandmarks?.[0];
    if (landmarkPoints?.length) {
      landmarkBox = faceBoxFromLandmarkPoints(landmarkPoints);
    }
    blendCategories = mp?.results?.[0]?.faceBlendshapes?.[0]?.categories;
  }

  if (serverPreview?.box && serverPreview.detectorAvailable) {
    rawBox = serverPreview.box;
    bboxSource = "retinaface";
  } else if (landmarkBox) {
    rawBox = landmarkBox;
    bboxSource = "landmark";
  }

  if (
    !rawBox &&
    !landmarkPipelineActive &&
    captureCfg.detector === "retinaface" &&
    serverPreview?.box &&
    serverPreview.detectorAvailable
  ) {
    rawBox = serverPreview.box;
    bboxSource = "retinaface";
  }

  if (!rawBox && !landmarkPipelineActive) {
    rawBox = estimateFaceBoxFromSkin(data, width, height);
    if (rawBox) bboxSource = "skin";
  }

  const smoothedBox = smoothFaceBox(
    emptyState.smoothedBox,
    rawBox,
    MOBILE_PREVIEW_SMOOTH_ALPHA
  );
  const hasFaceEstimate =
    Boolean(smoothedBox && smoothedBox.width >= 0.05 && smoothedBox.height >= 0.05);
  const framing = analyzeFaceFraming(smoothedBox, emptyState.framing);
  const nextState: PreviewGuidanceState = {
    smoothedBox,
    framing: { quality: framing.quality, faceFill: framing.faceFill },
    expressionCalibration: emptyState.expressionCalibration,
    faceLandmarks: landmarkPoints?.length ? landmarkPoints : null,
  };

  let guidance = buildCaptureGuidance(lighting, framing, currentZoom, {
    showFaceCheck: needsMp || hasFaceEstimate,
  });

  if (options) {
    if (!expressionStep) {
      nextState.expressionCalibration = { openEarBaseline: null };
    }
    // Prefer the server blink/expression classifier whenever it returns scores —
    // on phones the native MediaPipe landmarker is often unavailable, so the
    // server result is what makes eye-closure detection actually work.
    const useClassifier = Boolean(
      serverPreview?.expressionAvailable && serverPreview.expression
    );

    if (useClassifier) {
      const classified = applyCaptureExpressionFromClassifier(
        guidance,
        options.stepId,
        serverPreview!.expression,
        options.expressionOkRef,
        true
      );
      guidance = {
        ...guidance,
        ...classified,
        showExpressionCheck: expressionStep,
      };
    } else {
      guidance = applyCaptureExpression(
        guidance,
        options.stepId,
        blendCategories,
        options.expressionOkRef,
        landmarkPoints,
        landmarkPipelineActive || Boolean(serverPreview),
        nextState.expressionCalibration
      );
    }
  }

  return {
    guidance,
    state: nextState,
    meta: {
      bboxSource,
      landmarkPipelineActive,
      serverDetectorUsed: Boolean(serverPreview?.box && serverPreview.detectorAvailable),
      expressionClassifierUsed: Boolean(
        serverPreview?.expressionAvailable && serverPreview.expression
      ),
    },
  };
}
