import { decode } from "jpeg-js";
import { Buffer } from "buffer";
import * as ImageManipulator from "expo-image-manipulator";

import {
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
import { extractFaceLandmarkPoints } from "@/lib/nativeFaceLandmarkDetection";
import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import { faceBoxFromLandmarkPoints } from "../../src/lib/facePortraitBox";
import {
  analyzeFaceFraming,
  analyzeLightingFromRgba,
  buildCaptureGuidance,
  estimateFaceBoxFromSkin,
  expandSquarePreviewBoxToPortraitFrame,
  isSquarePreviewImage,
  shrinkNormalizedFaceBox,
  smoothFaceBox,
  type CaptureGuidanceSnapshot,
  type NormalizedFaceBox,
  type StableFramingState,
} from "@/lib/scanCaptureGuidance";

const PREVIEW_WIDTH = 180;
/** Faster bbox smoothing for snappier guidance — matches web FACE_BOX_SMOOTH_ALPHA (0.35). */
const MOBILE_PREVIEW_SMOOTH_ALPHA = 0.35;
/** Reduced from 512 to speed up mobile landmark inference per tick. */
const LANDMARK_PREVIEW_WIDTH = 400;

/** Bake EXIF orientation into pixels before resize / native detection (see normalizeScanImage.ts). */
async function bakePreviewExifOrientation(uri: string): Promise<string> {
  try {
    const oriented = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return oriented.uri ?? uri;
  } catch {
    return uri;
  }
}

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
    bboxKind: string;
    landmarkCount: number;
    landmarkPipelineActive: boolean;
    serverDetectorUsed: boolean;
    expressionClassifierUsed: boolean;
    previewAspect: string;
  };
}> {
  const expressionStep = options ? needsExpressionCheck() : false;
  const captureCfg = getMobileFaceCaptureConfig();
  const needsMp = needsMediapipeOnClient(captureCfg);
  const landmarkPipelineActive =
    Boolean(options?.landmarkDetectionEnabled) && needsMp;
  /** When native MediaPipe runs on-device, do not let skin/server boxes override it. */
  const useServer =
    !landmarkPipelineActive &&
    (usesServerFacePreview(captureCfg) ||
      shouldTryServerPreviewOnClient(captureCfg) ||
      Boolean(options?.authToken));

  const orientedUri = await bakePreviewExifOrientation(uri);

  const [small, landmarkSized] = await Promise.all([
    ImageManipulator.manipulateAsync(
      orientedUri,
      [{ resize: { width: PREVIEW_WIDTH } }],
      {
        compress: 0.55,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    ),
    landmarkPipelineActive
      ? ImageManipulator.manipulateAsync(
          orientedUri,
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
  const emptyMeta = {
    bboxSource: "—",
    bboxKind: "—",
    landmarkCount: 0,
    landmarkPipelineActive: false,
    serverDetectorUsed: false,
    expressionClassifierUsed: false,
    previewAspect: "—",
  };
  if (!small.base64) {
    return { guidance: null, state: emptyState, meta: emptyMeta };
  }

  const buf = Buffer.from(small.base64, "base64");
  const decoded = decode(buf, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = decoded;
  if (!width || !height) {
    return { guidance: null, state: emptyState, meta: emptyMeta };
  }
  const previewAspect = `${width}:${height}`;

  const lighting = analyzeLightingFromRgba(data, width, height);

  let rawBox: NormalizedFaceBox | null = null;
  let landmarkBox: NormalizedFaceBox | null = null;
  let bboxSource = "—";
  let bboxKind = "—";
  let blendCategories: { categoryName?: string; score: number }[] | undefined;
  let landmarkPoints: Array<{ x: number; y: number }> | undefined;

  let serverPreview: Awaited<ReturnType<typeof fetchFacePreviewInference>> = null;
  if (useServer && options?.authToken) {
    const previewUri = landmarkSized?.uri ?? small.uri ?? uri;
    serverPreview = await fetchFacePreviewInference(options.authToken, previewUri);
  }

  const landmarkUri = landmarkSized?.uri ?? small.uri ?? uri;
  if (landmarkPipelineActive) {
    const mp = await detectFaceLandmarksForPreview(landmarkUri);
    landmarkPoints = extractFaceLandmarkPoints(mp) ?? undefined;
    if (landmarkPoints?.length) {
      landmarkBox = faceBoxFromLandmarkPoints(landmarkPoints);
      if (landmarkBox) bboxKind = "portrait";
    }
    blendCategories = mp?.results?.[0]?.faceBlendshapes?.[0]?.categories;
  }

  // On-device MediaPipe targets the 18–32% fill band; server RetinaFace often
  // reports a much larger box — shrink fallbacks so fill % stays in range.
  if (landmarkBox) {
    rawBox = landmarkBox;
    bboxSource = "landmark";
  } else if (!landmarkPipelineActive) {
    const skinBox = estimateFaceBoxFromSkin(data, width, height);
    if (skinBox) {
      rawBox = shrinkNormalizedFaceBox(skinBox, 0.8);
      bboxSource = "skin";
      bboxKind = "skin";
    } else if (serverPreview?.box && serverPreview.detectorAvailable) {
      rawBox = shrinkNormalizedFaceBox(serverPreview.box, 0.74);
      bboxSource = "retinaface";
      bboxKind = "server";
    }
  } else {
    if (!serverPreview && options?.authToken) {
      const previewUri = landmarkSized?.uri ?? small.uri ?? uri;
      serverPreview = await fetchFacePreviewInference(options.authToken, previewUri);
    }
    if (serverPreview?.box && serverPreview.detectorAvailable) {
      rawBox = shrinkNormalizedFaceBox(serverPreview.box, 0.74);
      bboxSource = "mp-fallback-server";
      bboxKind = "server";
    } else {
      const skinBox = estimateFaceBoxFromSkin(data, width, height);
      if (skinBox) {
        rawBox = shrinkNormalizedFaceBox(skinBox, 0.8);
        bboxSource = "mp-fallback-skin";
        bboxKind = "skin";
      } else {
        bboxSource = "landmark-miss";
        bboxKind = "none";
      }
    }
  }

  if (rawBox && isSquarePreviewImage(width, height)) {
    rawBox = expandSquarePreviewBoxToPortraitFrame(rawBox);
  }

  const smoothedBox =
    landmarkPipelineActive && !rawBox
      ? null
      : smoothFaceBox(emptyState.smoothedBox, rawBox, MOBILE_PREVIEW_SMOOTH_ALPHA);
  const hasFaceEstimate =
    Boolean(smoothedBox && smoothedBox.width >= 0.05 && smoothedBox.height >= 0.05);
  const isSide = options?.stepId === "left" || options?.stepId === "right";
  const framing = analyzeFaceFraming(smoothedBox, emptyState.framing, isSide);
  const nextState: PreviewGuidanceState = {
    smoothedBox,
    framing: { quality: framing.quality, faceFill: framing.faceFill },
    expressionCalibration: emptyState.expressionCalibration,
    faceLandmarks: landmarkPoints?.length ? landmarkPoints : null,
  };

  const guidance = buildCaptureGuidance(lighting, framing, currentZoom, {
    showFaceCheck: needsMp || hasFaceEstimate,
  });

  // Expression / eye-closure detection is disabled on mobile (expressionStep is
  // always false), so we never apply blink guidance here. Keep calibration clear.
  if (options && !expressionStep) {
    nextState.expressionCalibration = { openEarBaseline: null };
    options.expressionOkRef.current = null;
  }

  return {
    guidance,
    state: nextState,
    meta: {
      bboxSource,
      bboxKind,
      landmarkCount: landmarkPoints?.length ?? 0,
      landmarkPipelineActive,
      serverDetectorUsed: Boolean(serverPreview?.box && serverPreview.detectorAvailable),
      expressionClassifierUsed: Boolean(
        serverPreview?.expressionAvailable && serverPreview.expression
      ),
      previewAspect,
    },
  };
}
