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
  /** MediaPipe Face Landmarker (framing + blink / smile). */
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

export { faceBoxFromLandmarkPoints } from "@/src/lib/facePortraitBox";

export type CaptureGuidanceSnapshot = {
  lighting: LightingQuality;
  lightingScore: number;
  lightingMessage: string;
  face: FaceFramingQuality;
  faceMessage: string;
  expressionOk: boolean | null;
  expressionMessage: string | null;
  /** Face height as fraction of frame (0–1), when detected */
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

/** Portrait oval (3:4) — hairline to chin; keep in sync with overlay SVG. */
export const OVAL_FRAME = {
  cx: 0.5,
  cy: 0.44,
  rx: 0.34,
  ry: 0.4,
} as const;

export const OVAL_REGION = {
  x0: OVAL_FRAME.cx - OVAL_FRAME.rx,
  y0: OVAL_FRAME.cy - OVAL_FRAME.ry,
  x1: OVAL_FRAME.cx + OVAL_FRAME.rx,
  y1: OVAL_FRAME.cy + OVAL_FRAME.ry,
};

const FACE_TARGET = { cx: OVAL_FRAME.cx, cy: OVAL_FRAME.cy };

/** Hysteresis — fill is relative to oval height (not full frame). */
const TOO_SMALL_ENTER = 0.46;
const TOO_SMALL_EXIT = 0.52;
const TOO_LARGE_ENTER = 0.9;
const TOO_LARGE_EXIT = 0.82;
const CENTER_ENTER_X = 0.2;
const CENTER_EXIT_X = 0.15;
const CENTER_ENTER_Y = 0.22;
const CENTER_EXIT_Y = 0.17;

export const CAPTURE_ZOOM_AUTO = {
  min: 1,
  max: 2.1,
  default: 1.12,
  /** Target vertical fill (hairline → chin) inside the oval. */
  targetFill: 0.56,
} as const;

const OVAL_HEIGHT = OVAL_FRAME.ry * 2;

/** Chin / neck extends below the oval (shoulders in frame). */
export function faceExtendsBelowOval(box: NormalizedFaceBox): boolean {
  return box.y + box.height > OVAL_REGION.y1 + 0.05;
}

/** How much of the oval band the face box occupies vertically (0–1). */
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

/** EMA smooth on face bbox between frames. */
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

/** Relative luminance 0–255 from sRGB bytes. */
function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Analyze lighting inside an oval-shaped central region of RGBA pixels.
 */
export function analyzeLightingFromRgba(
  data: Uint8ClampedArray,
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
    message = "Flat lighting — add a soft light source in front of you";
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

/** Map face fill to web capture zoom (digital crop, 1 = no crop). */
export function suggestCaptureZoom(
  currentZoom: number,
  faceFill: number | null,
  framingQuality: FaceFramingQuality | null = null,
  targetFill = CAPTURE_ZOOM_AUTO.targetFill
): number | null {
  if (faceFill == null || faceFill < 0.06) return null;
  if (framingQuality === "too_large" && currentZoom > CAPTURE_ZOOM_AUTO.min) {
    const out = clamp(currentZoom * 0.88, CAPTURE_ZOOM_AUTO.min, CAPTURE_ZOOM_AUTO.max);
    if (Math.abs(out - currentZoom) < 0.04) return null;
    return Math.round(out * 20) / 20;
  }
  if (faceFill > TOO_LARGE_ENTER) return null;
  const ratio = targetFill / faceFill;
  const raw = clamp(currentZoom * ratio, CAPTURE_ZOOM_AUTO.min, CAPTURE_ZOOM_AUTO.max);
  const next = currentZoom * 0.55 + raw * 0.45;
  if (Math.abs(next - currentZoom) < 0.04) return null;
  return Math.round(next * 20) / 20;
}

export function smoothTowardZoom(current: number, target: number, factor = 0.5): number {
  return Math.round((current * (1 - factor) + target * factor) * 20) / 20;
}

export function buildCaptureGuidance(
  lighting: ReturnType<typeof analyzeLightingFromRgba>,
  framing: ReturnType<typeof analyzeFaceFraming>,
  currentZoom: number
): CaptureGuidanceSnapshot {
  const suggestedZoom = suggestCaptureZoom(
    currentZoom,
    framing.faceFill,
    framing.quality
  );
  const lightingOk =
    lighting.quality === "good" || lighting.score >= 55;
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
  cropZoom = 1
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
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sampleWidth, sampleHeight);
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
