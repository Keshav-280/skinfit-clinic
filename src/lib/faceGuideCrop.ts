import type { FaceScanCaptureId } from "@/src/lib/faceScanCaptures";

/** Front-face guide ellipse — shared with `CaptureFaceGuideOverlayWeb`. */
export const FRONT_GUIDE_ELLIPSE = {
  cx: 50,
  cy: 50,
  rx: 42,
  ry: 52,
} as const;

/** Mobile dashed guide (30–60% fill band) — used for crop + overlay on native. */
export const MOBILE_FRONT_GUIDE_ELLIPSE = {
  cx: 50,
  cy: 50,
  rx: 32,
  ry: 39,
} as const;

export type FaceGuideEllipse = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

const VIEWBOX_SIZE = 100;
/** Square overlay height as a fraction of the 3:4 viewfinder (`meet` centering). */
const OVERLAY_HEIGHT_FRACTION = 3 / 4;
const OVERLAY_TOP_PAD = (1 - OVERLAY_HEIGHT_FRACTION) / 2;

/** First (front) and last (smiling) — tight 3:4 crop around the face guide. */
const FACE_GUIDE_CROP_STEPS = new Set<FaceScanCaptureId>(["centre", "smiling"]);

export function shouldCropToFaceGuide(stepId: FaceScanCaptureId): boolean {
  return FACE_GUIDE_CROP_STEPS.has(stepId);
}

/** Smallest 3:4 (w:h) rectangle that contains the front guide ellipse. */
export function getFrontGuideCropRectViewBox(
  ellipse: FaceGuideEllipse = FRONT_GUIDE_ELLIPSE
): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const { cx, cy, rx, ry } = ellipse;
  const ellipseW = rx * 2;
  const ellipseH = ry * 2;
  const aspect = 3 / 4;

  let w = ellipseW;
  let h = w / aspect;
  if (h < ellipseH) {
    h = ellipseH;
    w = h * aspect;
  }

  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

export function viewBoxRectToViewfinderNorm(rect: {
  x: number;
  y: number;
  w: number;
  h: number;
}): { x: number; y: number; w: number; h: number } {
  return {
    x: rect.x / VIEWBOX_SIZE,
    y: OVERLAY_TOP_PAD + (rect.y / VIEWBOX_SIZE) * OVERLAY_HEIGHT_FRACTION,
    w: rect.w / VIEWBOX_SIZE,
    h: (rect.h / VIEWBOX_SIZE) * OVERLAY_HEIGHT_FRACTION,
  };
}

/** Map a viewfinder-normalized rect to uncropped source video pixels (`object-cover`). */
export function viewfinderNormRectToVideoSource(
  rect: { x: number; y: number; w: number; h: number },
  videoW: number,
  videoH: number,
  viewfinderW: number,
  viewfinderH: number
): { x: number; y: number; w: number; h: number } {
  return viewfinderNormRectToVideoSourceWithZoom(
    rect,
    videoW,
    videoH,
    viewfinderW,
    viewfinderH,
    1
  );
}

/**
 * Source video region visible in the viewfinder with `object-cover` and center CSS zoom.
 * Matches `<video class="object-cover" style="transform: scale(zoom)">`.
 */
export function getVisibleVideoRect(
  videoW: number,
  videoH: number,
  viewfinderW: number,
  viewfinderH: number,
  zoom: number
): { sx: number; sy: number; sw: number; sh: number } {
  const z = zoom > 0 ? zoom : 1;
  const scale = Math.max(viewfinderW / videoW, viewfinderH / videoH);
  const sw = viewfinderW / scale / z;
  const sh = viewfinderH / scale / z;
  return {
    sx: (videoW - sw) / 2,
    sy: (videoH - sh) / 2,
    sw,
    sh,
  };
}

/** Map a viewfinder-normalized rect to source pixels within the visible video region. */
export function viewfinderNormRectToVideoSourceWithZoom(
  rect: { x: number; y: number; w: number; h: number },
  videoW: number,
  videoH: number,
  viewfinderW: number,
  viewfinderH: number,
  zoom: number
): { x: number; y: number; w: number; h: number } {
  const { sx, sy, sw, sh } = getVisibleVideoRect(
    videoW,
    videoH,
    viewfinderW,
    viewfinderH,
    zoom
  );

  const fx = rect.x * viewfinderW;
  const fy = rect.y * viewfinderH;
  const fw = rect.w * viewfinderW;
  const fh = rect.h * viewfinderH;

  return {
    x: sx + (fx / viewfinderW) * sw,
    y: sy + (fy / viewfinderH) * sh,
    w: (fw / viewfinderW) * sw,
    h: (fh / viewfinderH) * sh,
  };
}

function enforcePortrait34Crop(
  x: number,
  y: number,
  w: number,
  h: number,
  boundsW: number,
  boundsH: number,
  mirror: boolean
): { x: number; y: number; w: number; h: number } | null {
  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(w, boundsW - x);
  h = Math.min(h, boundsH - y);
  if (w <= 1 || h <= 1) return null;

  const targetH = (w * 4) / 3;
  if (Math.abs(targetH - h) > 0.5) {
    if (targetH <= boundsH - y) {
      h = targetH;
    } else {
      w = (h * 3) / 4;
      if (mirror) {
        x = boundsW - x - w;
      } else {
        x = Math.min(x, boundsW - w);
      }
    }
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
  };
}

/** Crop rect in full source-image pixels (mobile still / sensor frame). */
export function computeFaceGuideCropInSourcePixels(params: {
  sourceW: number;
  sourceH: number;
  viewfinderW: number;
  viewfinderH: number;
  zoom?: number;
  /** Pass true only when the source is still unmirrored (web canvas path). */
  mirror?: boolean;
  ellipse?: FaceGuideEllipse;
}): { x: number; y: number; w: number; h: number } | null {
  const {
    sourceW,
    sourceH,
    viewfinderW,
    viewfinderH,
    zoom = 1,
    mirror = false,
    ellipse = FRONT_GUIDE_ELLIPSE,
  } = params;
  if (!sourceW || !sourceH || !viewfinderW || !viewfinderH) return null;

  const viewBoxRect = getFrontGuideCropRectViewBox(ellipse);
  const vfNorm = viewBoxRectToViewfinderNorm(viewBoxRect);
  const videoRect = viewfinderNormRectToVideoSourceWithZoom(
    vfNorm,
    sourceW,
    sourceH,
    viewfinderW,
    viewfinderH,
    zoom
  );

  const y = videoRect.y;
  const w = videoRect.w;
  const h = videoRect.h;
  let x = videoRect.x;

  if (mirror) {
    x = sourceW - x - w;
  }

  return enforcePortrait34Crop(x, y, w, h, sourceW, sourceH, mirror);
}

export function computeFaceGuideCropOnCanvas(params: {
  videoW: number;
  videoH: number;
  canvasW: number;
  canvasH: number;
  viewfinderW: number;
  viewfinderH: number;
  zoom: number;
  mirror: boolean;
  ellipse?: FaceGuideEllipse;
}): { x: number; y: number; w: number; h: number } | null {
  const { videoW, videoH, canvasW, canvasH, viewfinderW, viewfinderH, zoom, mirror, ellipse } =
    params;
  if (!videoW || !videoH || !canvasW || !canvasH || !viewfinderW || !viewfinderH) {
    return null;
  }

  const sourceCrop = computeFaceGuideCropInSourcePixels({
    sourceW: videoW,
    sourceH: videoH,
    viewfinderW,
    viewfinderH,
    zoom,
    mirror: false,
    ellipse,
  });
  if (!sourceCrop) return null;

  const { sx, sy, sw, sh } = getVisibleVideoRect(
    videoW,
    videoH,
    viewfinderW,
    viewfinderH,
    zoom
  );
  const scaleX = canvasW / sw;
  const scaleY = canvasH / sh;

  const y = (sourceCrop.y - sy) * scaleY;
  const w = sourceCrop.w * scaleX;
  const h = sourceCrop.h * scaleY;
  let x = (sourceCrop.x - sx) * scaleX;

  if (mirror) {
    x = canvasW - x - w;
  }

  return enforcePortrait34Crop(x, y, w, h, canvasW, canvasH, mirror);
}

export function cropCanvasToFaceGuide(
  source: HTMLCanvasElement,
  crop: { x: number; y: number; w: number; h: number }
): HTMLCanvasElement | null {
  const ctx = source.getContext("2d");
  if (!ctx) return null;

  const out = document.createElement("canvas");
  out.width = crop.w;
  out.height = crop.h;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;

  outCtx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    0,
    0,
    crop.w,
    crop.h
  );
  return out;
}
