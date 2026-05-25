/**
 * Scan capture guidance (lighting + face framing) — shared logic for mobile preview analysis.
 */

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

export const OVAL_FRAME = {
  cx: 0.5,
  cy: 0.44,
  rx: 0.34,
  ry: 0.4,
} as const;

const OVAL_REGION = {
  x0: OVAL_FRAME.cx - OVAL_FRAME.rx,
  y0: OVAL_FRAME.cy - OVAL_FRAME.ry,
  x1: OVAL_FRAME.cx + OVAL_FRAME.rx,
  y1: OVAL_FRAME.cy + OVAL_FRAME.ry,
};

const FACE_TARGET = { cx: OVAL_FRAME.cx, cy: OVAL_FRAME.cy };

const TOO_SMALL_ENTER = 0.46;
const TOO_SMALL_EXIT = 0.52;
const TOO_LARGE_ENTER = 0.9;
const TOO_LARGE_EXIT = 0.82;
const CENTER_ENTER_X = 0.2;
const CENTER_EXIT_X = 0.15;
const CENTER_ENTER_Y = 0.22;
const CENTER_EXIT_Y = 0.17;

export const MOBILE_CAMERA_ZOOM = {
  min: 0,
  max: 0.5,
  default: 0.16,
  targetFill: 0.56,
} as const;

const OVAL_HEIGHT = OVAL_FRAME.ry * 2;

export function faceExtendsBelowOval(box: NormalizedFaceBox): boolean {
  return box.y + box.height > OVAL_REGION.y1 + 0.05;
}

export function effectiveFaceFill(box: NormalizedFaceBox): number {
  const y0 = Math.max(box.y, OVAL_REGION.y0);
  const y1 = Math.min(box.y + box.height, OVAL_REGION.y1);
  const overlapH = Math.max(0, y1 - y0);
  return overlapH / OVAL_HEIGHT;
}

export type StableFramingState = {
  quality: FaceFramingQuality;
  faceFill: number | null;
};

export function smoothFaceBox(
  prev: NormalizedFaceBox | null,
  next: NormalizedFaceBox | null,
  alpha = 0.32
): NormalizedFaceBox | null {
  if (!next) return prev;
  if (!prev) return next;
  const mix = (a: number, b: number) => a * (1 - alpha) + b * alpha;
  return {
    x: mix(prev.x, next.x),
    y: mix(prev.y, next.y),
    width: mix(prev.width, next.width),
    height: mix(prev.height, next.height),
  };
}

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
  region = OVAL_REGION
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

/** Estimate face bbox from skin pixels in the oval (no native ML). */
export function estimateFaceBoxFromSkin(
  data: Uint8Array,
  width: number,
  height: number,
  region = OVAL_REGION
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
  let ovalCount = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      ovalCount++;
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

  if (ovalCount < 16 || skinCount / ovalCount < 0.05) return null;

  const padX = Math.round((maxX - minX) * 0.04);
  const padY = Math.round((maxY - minY) * 0.05);
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(width - 1, maxX + padX);
  maxY = Math.min(height - 1, maxY + padY);
  const y1Cap = Math.floor(height * OVAL_REGION.y1);
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
      return "Center your face — fill the oval from hairline to chin";
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
      return `${hint} — keep hair to chin in the oval`;
    }
    case "too_small":
      return "Move closer — hair to chin should fill the oval";
    case "too_large":
      return "Pull back a little — keep shoulders out of frame";
    default:
      return "Hair to chin fills the oval — looks good";
  }
}

function classifyFraming(
  faceFill: number,
  offX: number,
  offY: number,
  prev: FaceFramingQuality | null,
  box: NormalizedFaceBox | null
): FaceFramingQuality {
  const p = prev ?? "no_face";

  if (box && faceExtendsBelowOval(box)) {
    return "too_large";
  }

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

export function analyzeFaceFraming(
  box: NormalizedFaceBox | null,
  prev?: StableFramingState | null
): { quality: FaceFramingQuality; message: string; faceFill: number | null } {
  if (!box || box.width < 0.03 || box.height < 0.03) {
    const q: FaceFramingQuality =
      prev?.quality === "good" ? "good" : "no_face";
    return {
      quality: q,
      message: framingMessage(q, FACE_TARGET.cx, FACE_TARGET.cy),
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
    prev?.quality ?? null,
    box
  );

  return {
    quality,
    message: framingMessage(quality, cx, cy),
    faceFill,
  };
}

export function suggestMobileCameraZoom(
  currentZoom: number,
  faceFill: number | null,
  framingQuality: FaceFramingQuality | null = null,
  targetFill = MOBILE_CAMERA_ZOOM.targetFill
): number | null {
  if (faceFill == null || faceFill < 0.06) return null;
  if (
    framingQuality === "too_large" &&
    currentZoom > MOBILE_CAMERA_ZOOM.min
  ) {
    const out = clamp(
      currentZoom * 0.88,
      MOBILE_CAMERA_ZOOM.min,
      MOBILE_CAMERA_ZOOM.max
    );
    if (Math.abs(out - currentZoom) < 0.02) return null;
    return Math.round(out * 100) / 100;
  }
  if (faceFill > TOO_LARGE_ENTER) return null;
  const ratio = targetFill / faceFill;
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
