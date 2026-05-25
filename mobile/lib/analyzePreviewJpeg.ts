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
/** Higher-res still for MediaPipe (eyes / smile need detail). */
const LANDMARK_PREVIEW_WIDTH = 512;

export type PreviewGuidanceState = {
  smoothedBox: NormalizedFaceBox | null;
  framing: StableFramingState | null;
  expressionCalibration: ExpressionCalibration;
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
): Promise<{ guidance: CaptureGuidanceSnapshot | null; state: PreviewGuidanceState }> {
  const expressionStep = options ? needsExpressionCheck(options.stepId) : false;
  const captureCfg = getMobileFaceCaptureConfig();
  const useServer = usesServerFacePreview(captureCfg);
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
  };
  if (!small.base64) return { guidance: null, state: emptyState };

  const buf = Buffer.from(small.base64, "base64");
  const decoded = decode(buf, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = decoded;
  if (!width || !height) return { guidance: null, state: emptyState };

  const lighting = analyzeLightingFromRgba(data, width, height);

  let rawBox: NormalizedFaceBox | null = null;
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
      rawBox = faceBoxFromLandmarkPoints(landmarkPoints);
    }
    blendCategories = mp?.results?.[0]?.faceBlendshapes?.[0]?.categories;
  }

  if (
    captureCfg.detector === "retinaface" &&
    serverPreview?.box &&
    serverPreview.detectorAvailable
  ) {
    rawBox = serverPreview.box;
  }

  if (!rawBox) {
    rawBox = estimateFaceBoxFromSkin(data, width, height);
  }

  const smoothedBox = smoothFaceBox(emptyState.smoothedBox, rawBox);
  const hasFaceEstimate =
    Boolean(smoothedBox && smoothedBox.width >= 0.05 && smoothedBox.height >= 0.05);
  const framing = analyzeFaceFraming(smoothedBox, emptyState.framing);
  const nextState: PreviewGuidanceState = {
    smoothedBox,
    framing: { quality: framing.quality, faceFill: framing.faceFill },
    expressionCalibration: emptyState.expressionCalibration,
  };

  let guidance = buildCaptureGuidance(lighting, framing, currentZoom, {
    showFaceCheck: hasFaceEstimate,
  });

  if (options) {
    if (!expressionStep) {
      nextState.expressionCalibration = { openEarBaseline: null };
    }
    const useClassifier =
      captureCfg.expression === "classifier" &&
      Boolean(serverPreview?.expressionAvailable && serverPreview.expression);

    if (useClassifier) {
      guidance = applyCaptureExpressionFromClassifier(
        guidance,
        options.stepId,
        serverPreview!.expression,
        options.expressionOkRef,
        true
      );
      guidance = {
        ...guidance,
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

  return { guidance, state: nextState };
}
