/**
 * Real-time scan capture guidance (lighting + face framing).
 * No server round-trip — runs on preview frames in browser / mobile.
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

/** Browser capture assistants (web only). */
export type CaptureAssistModels = {
  /** Experimental Shape Detection API — not in Chrome stable / Safari. */
  faceDetector: "ready" | "unsupported";
  /** MediaPipe BlazeFace short-range (primary bbox). */
  blazeFace: "off" | "idle" | "loading" | "ready" | "failed";
  /** MediaPipe Face Landmarker (expression / eyes). */
  mediapipe: "off" | "idle" | "loading" | "ready" | "failed";
  /** Set when mediapipe === "failed" (truncated for UI). */
  mediapipeError?: string;
  /** Server RetinaFace preview (`FACE_DETECTOR=retinaface`). */
  retinaface: "idle" | "loading" | "ready" | "failed" | "off";
  retinafaceError?: string;
  /** Server blink/smile classifier (`FACE_EXPRESSION=classifier`). */
  expressionClassifier: "idle" | "ready" | "failed" | "off";
};

/** Same-origin WASM (see `npm run mediapipe:sync-wasm`), then CDN fallback. */
export function mediapipeWasmRoot(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/mediapipe-wasm`;
  }
  return "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
}

export { faceBoxFromLandmarkPoints } from "./facePortraitBox";

export type CaptureGuidanceSnapshot = {
  lighting: LightingQuality;
  lightingScore: number;
  lightingMessage: string;
  face: FaceFramingQuality;
  faceMessage: string;
  expressionOk: boolean | null;
  expressionMessage: string | null;
  /** Instant face∩frame area (0–1) — used for framing and auto-zoom */
  faceFill: number | null;
  /** Suggested digital crop zoom for web (1 = full frame) */
  suggestedZoom: number | null;
  /** Whether capture is recommended (both lighting + framing acceptable) */
  readyToCapture: boolean;
};

/** Normalized face box in frame coordinates (0–1), origin top-left. */
export type NormalizedFaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Full camera preview — guidance uses entire frame (no cutout region). */
export const CAPTURE_FRAME = {
  x0: 0,
  y0: 0,
  x1: 1,
  y1: 1,
} as const;

export const FRAME_REGION = CAPTURE_FRAME;

const FACE_TARGET = {
  cx: (FRAME_REGION.x0 + FRAME_REGION.x1) / 2,
  cy: (FRAME_REGION.y0 + FRAME_REGION.y1) / 2,
};

/**
 * Ideal face bbox area as fraction of full frame (portrait box ∩ frame).
 *
 * The whole face must sit INSIDE the guide ellipse (cx=50%, cy=50%, rx=42%, ry=52%)
 * with margin — hairline, both cheeks and chin all visible, not clipped.
 *
 * The face portrait box (hairline→chin, cheek-to-cheek) should be clearly smaller
 * than the frame so it fits within the ellipse. Empirically a face fill of
 * ~18–32% places the whole head inside the ellipse with comfortable margin.
 * Higher than this and the face gets cropped at the forehead/chin.
 *
 * Target band: **12–42%** with **±3%** hysteresis. Auto-zoom converges to ~27%.
 * Widened from 18–32% so the user does not have to move uncomfortably close
 * (or back) to land in the "good" band.
 */
export const IDEAL_FACE_FILL_MIN = 0.12;
export const IDEAL_FACE_FILL_MAX = 0.42;
/** ±3 percentage points — enter/exit "move closer" / "ease back" outside the band. */
export const CAPTURE_FRAMING_TOLERANCE = 0.03;
/** Center of ideal band — auto-zoom converges here. */
export const IDEAL_FACE_FILL_AREA =
  (IDEAL_FACE_FILL_MIN + IDEAL_FACE_FILL_MAX) / 2;

/** Hysteresis — too-small / too-large bands around the 18–32% ideal band. */
export const CAPTURE_FRAMING_THRESHOLDS = {
  /** Below 15% — enter "move closer" */
  tooSmallEnter: IDEAL_FACE_FILL_MIN - CAPTURE_FRAMING_TOLERANCE,
  /** At or above 18% — exit "too small" / framing size OK (lower bound) */
  tooSmallExit: IDEAL_FACE_FILL_MIN,
  /** Above 35% — enter "ease back" */
  tooLargeEnter: IDEAL_FACE_FILL_MAX + CAPTURE_FRAMING_TOLERANCE,
  /** At or below 32% — exit "too large" (upper bound of good band) */
  tooLargeExit: IDEAL_FACE_FILL_MAX,
  /** Centering: keep face within the ellipse guide. */
  centerEnterX: 0.15,
  centerExitX: 0.10,
  centerEnterY: 0.18,
  centerExitY: 0.12,
} as const;

const TOO_SMALL_ENTER = CAPTURE_FRAMING_THRESHOLDS.tooSmallEnter;
const TOO_SMALL_EXIT = CAPTURE_FRAMING_THRESHOLDS.tooSmallExit;
const TOO_LARGE_ENTER = CAPTURE_FRAMING_THRESHOLDS.tooLargeEnter;
const TOO_LARGE_EXIT = CAPTURE_FRAMING_THRESHOLDS.tooLargeExit;
const CENTER_ENTER_X = CAPTURE_FRAMING_THRESHOLDS.centerEnterX;
const CENTER_EXIT_X = CAPTURE_FRAMING_THRESHOLDS.centerExitX;
const CENTER_ENTER_Y = CAPTURE_FRAMING_THRESHOLDS.centerEnterY;
const CENTER_EXIT_Y = CAPTURE_FRAMING_THRESHOLDS.centerExitY;

/** Auto-zoom converges toward center of the 18–32% ideal band (25%). */
export function captureAutoZoomTargetFill(): number {
  return IDEAL_FACE_FILL_AREA;
}

export const CAPTURE_ZOOM_AUTO = {
  min: 1,
  /** Manual zoom headroom — let the user crop in closer when they want to. */
  max: 3,
  /** Start at full frame; auto-zoom nudges toward the ideal face area. */
  default: 1,
  targetFill: captureAutoZoomTargetFill(),
} as const;

/**
 * How long to accumulate frames before updating guidance / auto-zoom (ms).
 * Reduced from 2000ms to 600ms for snappier guidance transitions across all devices.
 * The EMA smoothing on face bbox already prevents jitter, so a shorter publish window
 * gives users faster feedback without flickering.
 */
export const CAPTURE_GUIDANCE_SETTLE_MS = 600;

/**
 * Minimum lighting score required for `readyToCapture`.
 * Stricter than before (was 55) — for dermatological analysis the model needs
 * even illumination with enough detail visibility.
 */
export const LIGHTING_SCORE_READY_THRESHOLD = 60;

/**
 * EMA for portrait bbox — higher alpha = faster response to movement.
 * Increased from 0.14 to 0.35 so guidance reacts within 1–2 frames on both web and mobile.
 */
export const FACE_BOX_SMOOTH_ALPHA = 0.35;
/** Reject sudden bbox area jumps (skin fallback vs landmarks). */
const FACE_BOX_OUTLIER_RATIO_LO = 0.72;
const FACE_BOX_OUTLIER_RATIO_HI = 1.38;

const FRAME_WIDTH = FRAME_REGION.x1 - FRAME_REGION.x0;
const FRAME_HEIGHT = FRAME_REGION.y1 - FRAME_REGION.y0;
const FRAME_AREA = FRAME_WIDTH * FRAME_HEIGHT;

/** How much of the frame region the face box covers by area (0–1). */
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

/** EMA smooth on face bbox; dampens outlier jumps between detectors. */
export function smoothFaceBox(
  prev: NormalizedFaceBox | null,
  next: NormalizedFaceBox | null,
  alpha = FACE_BOX_SMOOTH_ALPHA
): NormalizedFaceBox | null {
  if (!next) return prev;
  if (!prev) return next;
  const prevArea = prev.width * prev.height;
  const nextArea = next.width * next.height;
  const ratio = nextArea / Math.max(prevArea, 1e-4);
  let useAlpha = alpha;
  if (ratio < FACE_BOX_OUTLIER_RATIO_LO || ratio > FACE_BOX_OUTLIER_RATIO_HI) {
    /** Snap on detector jumps (e.g. after step change or skin → landmark). */
    return next;
  }
  const mix = (a: number, b: number) => a * (1 - useAlpha) + b * useAlpha;
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

/** Relative luminance 0–255 from sRGB bytes. */
function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Analyze lighting inside the central capture frame of RGBA pixels.
 */
export function analyzeLightingFromRgba(
  data: Uint8ClampedArray,
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
  let satSum = 0;
  const midX = (x0 + x1) >> 1;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const L = luma(r, g, b);
      sum += L;
      sumSq += L * L;
      n++;
      if (L < 45) dark++;
      if (L > 210) bright++;
      // Per-pixel chroma (max−min) — covered cameras are near-grayscale.
      satSum += Math.max(r, g, b) - Math.min(r, g, b);
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

  const meanSat = satSum / n;
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

  // Covered lens / near-black: very low brightness OR a flat near-grayscale frame
  // (webcam auto-gain often brightens a covered lens to gray noise — catch that too).
  const coveredOrDark =
    mean < 90 ||
    darkRatio > 0.25 ||
    (meanSat < 10 && mean < 125);

  if (coveredOrDark) {
    quality = "too_dark";
    message = "Too dark — uncover the camera and face a window or soft light";
  } else if (mean > 185 || brightRatio > 0.18) {
    quality = "too_bright";
    message = "Too bright — step back from direct sun or harsh lamp";
  } else if (sideDelta > 30) {
    quality = "uneven";
    message = "Uneven light — rotate so both sides of your face are lit";
  } else if (std < 25) {
    quality = "low_contrast";
    message = "Flat lighting — add a soft light source in front of you";
  }

  const rawScore = clamp(
    Math.round(
      100 -
        Math.abs(mean - 128) * 0.4 -
        darkRatio * 90 -
        brightRatio * 90 -
        sideDelta * 0.8 -
        Math.max(0, 30 - std) * 1.5
    ),
    0,
    100
  );

  // Never let the numeric score override an explicit bad-quality verdict
  // (otherwise a gray covered frame could score >60 and read as "ready").
  const score = quality === "good" ? rawScore : Math.min(rawScore, 40);

  return { quality, score, message, meanLuma: mean };
}

function isSkinPixel(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  return (
    r > 55 &&
    g > 28 &&
    b > 12 &&
    delta > 10 &&
    r >= g - 8 &&
    luma(r, g, b) > 35 &&
    luma(r, g, b) < 225
  );
}

/** Fallback when browser FaceDetector is unavailable (Chrome/Edge only). */
export function estimateFaceBoxFromSkin(
  data: Uint8ClampedArray | Uint8Array,
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
      return "Face not detected, look at the camera";
    case "off_center": {
      const offX = Math.abs(cx - FACE_TARGET.cx);
      const offY = Math.abs(cy - FACE_TARGET.cy);
      if (offX > offY) {
        return cx < FACE_TARGET.cx
          ? "Move slightly right"
          : "Move slightly left";
      }
      return cy < FACE_TARGET.cy
        ? "Lower your chin slightly"
        : "Raise your chin slightly";
    }
    case "too_small":
      return "Move closer to the camera";
    case "too_large":
      return "Ease back a little";
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

export function isUsableFaceBox(
  box: NormalizedFaceBox | null
): box is NormalizedFaceBox {
  return Boolean(
    box && box.width >= MIN_FACE_BOX && box.height >= MIN_FACE_BOX
  );
}

/** Average recent face boxes for stable guidance (1–1.5s window). */
export function averageFaceBoxes(
  boxes: Array<NormalizedFaceBox | null>
): NormalizedFaceBox | null {
  const usable = boxes.filter(isUsableFaceBox) as NormalizedFaceBox[];
  if (!usable.length) return null;
  const n = usable.length;
  let x = 0;
  let y = 0;
  let w = 0;
  let h = 0;
  for (const b of usable) {
    x += b.x;
    y += b.y;
    w += b.width;
    h += b.height;
  }
  return { x: x / n, y: y / n, width: w / n, height: h / n };
}

export function analyzeFaceFraming(
  box: NormalizedFaceBox | null,
  prev?: StableFramingState | null
): {
  quality: FaceFramingQuality;
  message: string;
  faceFill: number | null;
} {
  if (!isUsableFaceBox(box)) {
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

/**
 * Map face fill to web capture zoom (digital crop, 1 = no crop).
 * Auto-zoom zooms in when face is too small and out when too large.
 */
export function suggestCaptureZoom(
  currentZoom: number,
  faceFill: number | null,
  _framingQuality: FaceFramingQuality | null = null,
  targetFill = captureAutoZoomTargetFill()
): number | null {
  if (faceFill == null || faceFill < 0.04) return null;
  if (
    faceFill >= IDEAL_FACE_FILL_MIN &&
    faceFill <= IDEAL_FACE_FILL_MAX
  ) {
    return null;
  }
  // Face area ~ 1/zoom² for center crop — adjust zoom toward target fill.
  const ratio = Math.sqrt(targetFill / Math.max(faceFill, 0.04));
  const raw = clamp(
    currentZoom * ratio,
    CAPTURE_ZOOM_AUTO.min,
    CAPTURE_ZOOM_AUTO.max
  );
  const next = currentZoom * 0.5 + raw * 0.5;
  if (Math.abs(next - currentZoom) < 0.04) return null;
  return Math.round(next * 20) / 20;
}

export function smoothTowardZoom(current: number, target: number, factor = 0.5): number {
  return Math.round((current * (1 - factor) + target * factor) * 20) / 20;
}

export function buildCaptureGuidance(
  lighting: ReturnType<typeof analyzeLightingFromRgba>,
  framing: ReturnType<typeof analyzeFaceFraming>,
  currentZoom: number,
  opts?: { showFaceCheck?: boolean }
): CaptureGuidanceSnapshot {
  const suggestedZoom = suggestCaptureZoom(
    currentZoom,
    framing.faceFill,
    framing.quality
  );
  const lightingOk =
    lighting.quality === "good" || lighting.score >= LIGHTING_SCORE_READY_THRESHOLD;
  const faceOk = framing.quality === "good";
  const readyToCapture = lightingOk && faceOk;

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
  };
}

/**
 * Sample video frame (optionally the same center crop as preview zoom).
 * `cropZoom` 1 = full frame; 2 = center half matching CSS scale(2).
 */
export function sampleVideoFrame(
  video: HTMLVideoElement,
  sampleWidth = 160,
  sampleHeight = 200,
  cropZoom = 1,
  /** Same CSS filter as live preview (brightness/contrast sliders). */
  imageFilter?: string
): ImageData | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const z = Math.max(1, cropZoom);
  const sw = w / z;
  const sh = h / z;
  const sx = (w - sw) / 2;
  const sy = (h - sh) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.filter = imageFilter?.trim() || "none";
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sampleWidth, sampleHeight);
  ctx.filter = "none";
  return ctx.getImageData(0, 0, sampleWidth, sampleHeight);
}

/** Browser FaceDetector (Chrome/Edge) — no extra model download. */
export type BrowserFaceDetector = {
  detect: (source: ImageBitmapSource) => Promise<
    Array<{ boundingBox: DOMRectReadOnly }>
  >;
};

export function getBrowserFaceDetector(): BrowserFaceDetector | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { FaceDetector?: new () => BrowserFaceDetector };
  if (!w.FaceDetector) return null;
  try {
    return new w.FaceDetector();
  } catch {
    return null;
  }
}

export function faceBoxFromDomRect(
  box: DOMRectReadOnly,
  frameW: number,
  frameH: number
): NormalizedFaceBox {
  return {
    x: box.x / frameW,
    y: box.y / frameH,
    width: box.width / frameW,
    height: box.height / frameH,
  };
}

export async function detectFaceBoxNormalized(
  source: ImageBitmapSource,
  frameW: number,
  frameH: number
): Promise<NormalizedFaceBox | null> {
  const detector = getBrowserFaceDetector();
  if (!detector) return null;
  try {
    const faces = await detector.detect(source);
    if (!faces.length) return null;
    let best = faces[0].boundingBox;
    let bestArea = best.width * best.height;
    for (let i = 1; i < faces.length; i++) {
      const b = faces[i].boundingBox;
      const area = b.width * b.height;
      if (area > bestArea) {
        best = b;
        bestArea = area;
      }
    }
    return faceBoxFromDomRect(best, frameW, frameH);
  } catch {
    return null;
  }
}
