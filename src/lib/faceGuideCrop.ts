import type { FaceScanCaptureId } from "@/src/lib/faceScanCaptures";

/** Front-face guide ellipse — shared with `CaptureFaceGuideOverlayWeb`. */
export const FRONT_GUIDE_ELLIPSE = {
  cx: 50,
  cy: 50,
  rx: 42,
  ry: 52,
} as const;

const VIEWBOX_SIZE = 100;
/** Square overlay height as a fraction of the 3:4 viewfinder (`meet` centering). */
const OVERLAY_HEIGHT_FRACTION = 3 / 4;
const OVERLAY_TOP_PAD = (1 - OVERLAY_HEIGHT_FRACTION) / 2;

const FACE_GUIDE_CROP_STEPS = new Set<FaceScanCaptureId>(["centre", "smiling"]);

export function shouldCropToFaceGuide(stepId: FaceScanCaptureId): boolean {
  return FACE_GUIDE_CROP_STEPS.has(stepId);
}

/** Smallest 3:4 (w:h) rectangle that contains the front guide ellipse. */
export function getFrontGuideCropRectViewBox(): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const { cx, cy, rx, ry } = FRONT_GUIDE_ELLIPSE;
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
  const scale = Math.max(viewfinderW / videoW, viewfinderH / videoH);
  const displayW = videoW * scale;
  const displayH = videoH * scale;
  const offsetX = (displayW - viewfinderW) / 2;
  const offsetY = (displayH - viewfinderH) / 2;

  const fx = rect.x * viewfinderW;
  const fy = rect.y * viewfinderH;
  const fw = rect.w * viewfinderW;
  const fh = rect.h * viewfinderH;

  return {
    x: (fx + offsetX) / scale,
    y: (fy + offsetY) / scale,
    w: fw / scale,
    h: fh / scale,
  };
}

function getZoomWindow(videoW: number, videoH: number, zoom: number) {
  const sw = videoW / zoom;
  const sh = videoH / zoom;
  return {
    sx: (videoW - sw) / 2,
    sy: (videoH - sh) / 2,
    sw,
    sh,
  };
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
}): { x: number; y: number; w: number; h: number } | null {
  const { videoW, videoH, canvasW, canvasH, viewfinderW, viewfinderH, zoom, mirror } =
    params;
  if (
    !videoW ||
    !videoH ||
    !canvasW ||
    !canvasH ||
    !viewfinderW ||
    !viewfinderH ||
    zoom <= 0
  ) {
    return null;
  }

  const viewBoxRect = getFrontGuideCropRectViewBox();
  const vfNorm = viewBoxRectToViewfinderNorm(viewBoxRect);
  const videoRect = viewfinderNormRectToVideoSource(
    vfNorm,
    videoW,
    videoH,
    viewfinderW,
    viewfinderH
  );

  const { sx, sy, sw, sh } = getZoomWindow(videoW, videoH, zoom);
  const scaleX = canvasW / sw;
  const scaleY = canvasH / sh;

  let x = (videoRect.x - sx) * scaleX;
  let y = (videoRect.y - sy) * scaleY;
  let w = videoRect.w * scaleX;
  let h = videoRect.h * scaleY;

  if (mirror) {
    x = canvasW - x - w;
  }

  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(w, canvasW - x);
  h = Math.min(h, canvasH - y);
  if (w <= 1 || h <= 1) return null;

  const targetH = (w * 4) / 3;
  if (Math.abs(targetH - h) > 0.5) {
    if (targetH <= canvasH - y) {
      h = targetH;
    } else {
      w = (h * 3) / 4;
      if (mirror) {
        x = canvasW - x - w;
      } else {
        x = Math.min(x, canvasW - w);
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
