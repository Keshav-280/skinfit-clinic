/**
 * Scan capture guidance (lighting + face framing) — shared logic for mobile preview analysis.
 */

export type { CaptureAssistModels } from "../../src/lib/scanCaptureGuidance";

import {
  CAPTURE_FRAMING_THRESHOLDS,
  captureAutoZoomTargetFill,
  FACE_BOX_SMOOTH_ALPHA,
  IDEAL_FACE_FILL_MAX,
  IDEAL_FACE_FILL_MIN,
  smoothFaceBox,
} from "../../src/lib/scanCaptureGuidance";

export type LightingQuality =
  | "good"
  | "too_dark"
  | "too_bright"
  | "uneven"
  | "low_contrast";

export type FaceFramingQuality =
  | "good"
  | "too_small"
  | "too_large"
  | "off_center"
  | "no_face";

export type CaptureGuidanceSnapshot = {
  lighting: LightingQuality;
  lightingScore: number;
  lightingMessage: string;
  face: FaceFramingQuality;
  faceMessage: string;
  expressionOk: boolean | null;
  expressionMessage: string | null;
  faceFill: number | null;
  /** Expo CameraView zoom 0–1 */
  suggestedZoom: number | null;
  readyToCapture: boolean;
  /** UI: only render rows when the underlying check is actually running. */
  showLightingCheck: boolean;
  showFaceCheck: boolean;
  showExpressionCheck: boolean;
};

export { faceBoxFromLandmarkPoints } from "../../src/lib/facePortraitBox";

export type NormalizedFaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const CAPTURE_FRAME = {
  x0: 0,
  y0: 0,
  x1: 1,
  y1: 1,
} as const;

const FRAME_REGION = CAPTURE_FRAME;

const FACE_TARGET = {
  cx: (FRAME_REGION.x0 + FRAME_REGION.x1) / 2,
  cy: (FRAME_REGION.y0 + FRAME_REGION.y1) / 2,
};

const TOO_SMALL_ENTER = CAPTURE_FRAMING_THRESHOLDS.tooSmallEnter;
const TOO_SMALL_EXIT = CAPTURE_FRAMING_THRESHOLDS.tooSmallExit;
const TOO_LARGE_ENTER = CAPTURE_FRAMING_THRESHOLDS.tooLargeEnter;
const TOO_LARGE_EXIT = CAPTURE_FRAMING_THRESHOLDS.tooLargeExit;
const CENTER_ENTER_X = CAPTURE_FRAMING_THRESHOLDS.centerEnterX;
const CENTER_EXIT_X = CAPTURE_FRAMING_THRESHOLDS.centerExitX;
const CENTER_ENTER_Y = CAPTURE_FRAMING_THRESHOLDS.centerEnterY;
const CENTER_EXIT_Y = CAPTURE_FRAMING_THRESHOLDS.centerExitY;

/** Synced with web — 20–40% ideal face area; auto-zoom toward 30%. */
export const MOBILE_CAMERA_ZOOM = {
  min: 0,
  max: 0.58,
  default: 0.08,
  targetFill: captureAutoZoomTargetFill(),
} as const;

export {
  CAPTURE_FRAMING_THRESHOLDS,
  IDEAL_FACE_FILL_MIN,
  IDEAL_FACE_FILL_MAX,
  captureAutoZoomTargetFill,
};

const FRAME_WIDTH = FRAME_REGION.x1 - FRAME_REGION.x0;
const FRAME_HEIGHT = FRAME_REGION.y1 - FRAME_REGION.y0;
const FRAME_AREA = FRAME_WIDTH * FRAME_HEIGHT;

export function effectiveFaceFill(box: NormalizedFaceBox): number {
  const x0 = Math.max(box.x, FRAME_REGION.x0);
  const y0 = Math.max(box.y, FRAME_REGION.y0);
  const x1 = Math.min(box.x + box.width, FRAME_REGION.x1);
  const y1 = Math.min(box.y + box.height, FRAME_REGION.y1);
  const overlapW = Math.max(0, x1 - x0);
  const overlapH = Math.max(0, y1 - y0);
  return (overlapW * overlapH) / FRAME_AREA;
}

export type StableFramingState = {
  quality: FaceFramingQuality;
  faceFill: number | null;
};

export { smoothFaceBox, FACE_BOX_SMOOTH_ALPHA };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Inclusive skin-tone heuristic (works without ML Kit on device). */
function isSkinPixel(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  return (
    r > 60 &&
    g > 30 &&
    b > 15 &&
    delta > 12 &&
    r > g &&
    r > b &&
    luma(r, g, b) > 40 &&
    luma(r, g, b) < 220
  );
}

export function analyzeLightingFromRgba(
  data: Uint8Array,
  width: number,
  height: number,
  region = FRAME_REGION
): {
  quality: LightingQuality;
  score: number;
  message: string;
  meanLuma: number;
} {
  const x0 = Math.floor(width * region.x0);
  const x1 = Math.floor(width * region.x1);
  const y0 = Math.floor(height * region.y0);
  const y1 = Math.floor(height * region.y1);

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let dark = 0;
  let bright = 0;
  let leftSum = 0;
  let rightSum = 0;
  let leftN = 0;
  let rightN = 0;
  const midX = (x0 + x1) >> 1;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const L = luma(data[i], data[i + 1], data[i + 2]);
      sum += L;
      sumSq += L * L;
      n++;
      if (L < 45) dark++;
      if (L > 210) bright++;
      if (x < midX) {
        leftSum += L;
        leftN++;
      } else {
        rightSum += L;
        rightN++;
      }
    }
  }

  if (n < 16) {
    return {
      quality: "low_contrast",
      score: 0,
      message: "Point the camera at your face",
      meanLuma: 0,
    };
  }

  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const std = Math.sqrt(Math.max(0, variance));
  const darkRatio = dark / n;
  const brightRatio = bright / n;
  const leftMean = leftN ? leftSum / leftN : mean;
  const rightMean = rightN ? rightSum / rightN : mean;
  const sideDelta = Math.abs(leftMean - rightMean);

  let quality: LightingQuality = "good";
  let message = "Lighting looks good";

  if (mean < 72 || darkRatio > 0.35) {
    quality = "too_dark";
    message = "Too dark — face a window or turn on soft front light";
  } else if (mean > 195 || brightRatio > 0.22) {
    quality = "too_bright";
    message = "Too bright — step back from direct sun or harsh lamp";
  } else if (sideDelta > 42) {
    quality = "uneven";
    message = "Uneven light — rotate so both sides of your face are lit";
  } else if (std < 22) {
    quality = "low_contrast";
    message = "Flat lighting — add a soft light in front of you";
  }

  const score = clamp(
    Math.round(
      100 -
        Math.abs(mean - 128) * 0.35 -
        darkRatio * 80 -
        brightRatio * 80 -
        sideDelta * 0.6 -
        Math.max(0, 28 - std) * 1.2
    ),
    0,
    100
  );

  return { quality, score, message, meanLuma: mean };
}

/** Estimate face bbox from skin pixels in the capture frame (no native ML). */
export function estimateFaceBoxFromSkin(
  data: Uint8Array,
  width: number,
  height: number,
  region = FRAME_REGION
): NormalizedFaceBox | null {
  const x0 = Math.floor(width * region.x0);
  const x1 = Math.floor(width * region.x1);
  const y0 = Math.floor(height * region.y0);
  const y1 = Math.floor(height * region.y1);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let skinCount = 0;
  let frameCount = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      frameCount++;
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isSkinPixel(r, g, b)) continue;
      skinCount++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (frameCount < 16 || skinCount / frameCount < 0.035) return null;

  const padX = Math.round((maxX - minX) * 0.04);
  const padY = Math.round((maxY - minY) * 0.05);
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(width - 1, maxX + padX);
  maxY = Math.min(height - 1, maxY + padY);
  const y1Cap = Math.floor(height * FRAME_REGION.y1);
  if (maxY > y1Cap) maxY = y1Cap;

  return {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + 1) / width,
    height: (maxY - minY + 1) / height,
  };
}

function framingMessage(quality: FaceFramingQuality, cx: number, cy: number): string {
  switch (quality) {
    case "no_face":
      return "Center your face inside the frame";
    case "off_center": {
      const offX = Math.abs(cx - FACE_TARGET.cx);
      const offY = Math.abs(cy - FACE_TARGET.cy);
      const hint =
        offX > offY
          ? cx < FACE_TARGET.cx
            ? "Move slightly right"
            : "Move slightly left"
          : cy < FACE_TARGET.cy
            ? "Move slightly down"
            : "Move slightly up";
      return `${hint} — keep your face inside the frame`;
    }
    case "too_small":
      return "Move closer — face should cover about 20–40% of the frame";
    case "too_large":
      return "Ease back a little — keep face around 20–40% of the frame";
    default:
      return "Face framing looks good";
  }
}

function classifyFraming(
  faceFill: number,
  offX: number,
  offY: number,
  prev: FaceFramingQuality | null
): FaceFramingQuality {
  const p = prev ?? "no_face";

  if (p === "too_large") {
    if (faceFill >= TOO_LARGE_EXIT) return "too_large";
  } else if (faceFill > TOO_LARGE_ENTER) {
    return "too_large";
  }

  if (p === "too_small") {
    if (faceFill <= TOO_SMALL_EXIT) return "too_small";
  } else if (faceFill < TOO_SMALL_ENTER) {
    return "too_small";
  }

  if (p === "off_center") {
    if (offX > CENTER_EXIT_X || offY > CENTER_EXIT_Y) return "off_center";
  } else if (offX > CENTER_ENTER_X || offY > CENTER_ENTER_Y) {
    return "off_center";
  }

  return "good";
}

const MIN_FACE_BOX = 0.022;

export function analyzeFaceFraming(
  box: NormalizedFaceBox | null,
  prev?: StableFramingState | null
): {
  quality: FaceFramingQuality;
  message: string;
  faceFill: number | null;
} {
  if (!box || box.width < MIN_FACE_BOX || box.height < MIN_FACE_BOX) {
  if (
    prev?.quality &&
    prev.quality !== "no_face" &&
    prev.faceFill != null &&
    prev.faceFill >= MIN_FACE_BOX
  ) {
    return {
      quality: prev.quality,
      message: framingMessage(prev.quality, FACE_TARGET.cx, FACE_TARGET.cy),
      faceFill: prev.faceFill,
    };
  }
    return {
      quality: "no_face",
      message: framingMessage("no_face", FACE_TARGET.cx, FACE_TARGET.cy),
      faceFill: prev?.faceFill ?? null,
    };
  }

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const offX = Math.abs(cx - FACE_TARGET.cx);
  const offY = Math.abs(cy - FACE_TARGET.cy);
  const faceFill = effectiveFaceFill(box);
  const quality = classifyFraming(
    faceFill,
    offX,
    offY,
    prev?.quality ?? null
  );

  return {
    quality,
    message: framingMessage(quality, cx, cy),
    faceFill,
  };
}

/** Auto-zoom in and out toward target face fill (Expo CameraView 0–1). */
export function suggestMobileCameraZoom(
  currentZoom: number,
  faceFill: number | null,
  _framingQuality: FaceFramingQuality | null = null,
  targetFill = MOBILE_CAMERA_ZOOM.targetFill
): number | null {
  if (faceFill == null || faceFill < 0.04) return null;
  if (
    faceFill >= IDEAL_FACE_FILL_MIN &&
    faceFill <= IDEAL_FACE_FILL_MAX
  ) {
    return null;
  }
  const ratio = Math.sqrt(targetFill / Math.max(faceFill, 0.04));
  const raw = clamp(
    currentZoom * ratio,
    MOBILE_CAMERA_ZOOM.min,
    MOBILE_CAMERA_ZOOM.max
  );
  const next = currentZoom * 0.55 + raw * 0.45;
  if (Math.abs(next - currentZoom) < 0.025) return null;
  return Math.round(next * 100) / 100;
}

export function smoothTowardZoom(current: number, target: number, factor = 0.5): number {
  return Math.round((current * (1 - factor) + target * factor) * 100) / 100;
}

export function buildCaptureGuidance(
  lighting: ReturnType<typeof analyzeLightingFromRgba>,
  framing: ReturnType<typeof analyzeFaceFraming>,
  currentZoom: number,
  opts?: { showFaceCheck?: boolean }
): CaptureGuidanceSnapshot {
  const showFaceCheck = Boolean(opts?.showFaceCheck);
  const suggestedZoom = showFaceCheck
    ? suggestMobileCameraZoom(
        currentZoom,
        framing.faceFill,
        framing.quality
      )
    : null;
  const lightingOk =
    lighting.quality === "good" || lighting.score >= 55;
  const faceOk = framing.quality === "good";
  const readyToCapture = lightingOk && (!showFaceCheck || faceOk);

  return {
    lighting: lighting.quality,
    lightingScore: lighting.score,
    lightingMessage: lighting.message,
    face: framing.quality,
    faceMessage: framing.message,
    expressionOk: null,
    expressionMessage: null,
    faceFill: framing.faceFill,
    suggestedZoom,
    readyToCapture,
    showLightingCheck: true,
    showFaceCheck,
    showExpressionCheck: false,
  };
}
