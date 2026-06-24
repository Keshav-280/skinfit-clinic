import sharp from "sharp";

import type { FaceScanCaptureId } from "@/src/lib/faceScanCaptures";
import {
  computeFaceGuideCropInSourcePixels,
  computeFaceGuideCropOnViewfinderCanvas,
  FRONT_GUIDE_ELLIPSE,
  MOBILE_FRONT_GUIDE_ELLIPSE,
  shouldCropToFaceGuide,
} from "@/src/lib/faceGuideCrop";
import { SCAN_UPLOAD_JPEG_QUALITY } from "@/src/lib/scanImagePreview";

/** How the client framed the upload — drives tight ML crop math on the server. */
export type CaptureCropContext = {
  source: "mobile" | "web";
  viewfinderW?: number;
  viewfinderH?: number;
};

/**
 * Tight 3:4 crop around the face guide for ML inference only.
 * Identity verification always runs on the full uploaded JPEG first.
 */
export async function cropJpegBufferForMlStep(
  jpeg: Buffer,
  stepId: FaceScanCaptureId,
  ctx?: CaptureCropContext
): Promise<Buffer> {
  if (!shouldCropToFaceGuide(stepId)) return jpeg;

  const oriented = sharp(jpeg).rotate();
  const meta = await oriented.metadata();
  const sourceW = meta.width ?? 0;
  const sourceH = meta.height ?? 0;
  if (!sourceW || !sourceH) return jpeg;

  let crop: { x: number; y: number; w: number; h: number } | null = null;

  if (
    ctx?.source === "mobile" &&
    ctx.viewfinderW &&
    ctx.viewfinderH &&
    ctx.viewfinderW > 0 &&
    ctx.viewfinderH > 0
  ) {
    crop = computeFaceGuideCropInSourcePixels({
      sourceW,
      sourceH,
      viewfinderW: ctx.viewfinderW,
      viewfinderH: ctx.viewfinderH,
      zoom: 1,
      mirror: false,
      ellipse: MOBILE_FRONT_GUIDE_ELLIPSE,
    });
  } else {
    crop = computeFaceGuideCropOnViewfinderCanvas(
      sourceW,
      sourceH,
      FRONT_GUIDE_ELLIPSE
    );
  }

  if (!crop || crop.w <= 1 || crop.h <= 1) return jpeg;

  const left = Math.max(0, Math.min(Math.round(crop.x), sourceW - 1));
  const top = Math.max(0, Math.min(Math.round(crop.y), sourceH - 1));
  const width = Math.max(1, Math.min(Math.round(crop.w), sourceW - left));
  const height = Math.max(1, Math.min(Math.round(crop.h), sourceH - top));

  return oriented
    .extract({ left, top, width, height })
    .jpeg({ quality: SCAN_UPLOAD_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export async function fileForMlInference(
  file: File,
  stepId: FaceScanCaptureId,
  ctx?: CaptureCropContext
): Promise<File> {
  const buf = Buffer.from(await file.arrayBuffer());
  const cropped = await cropJpegBufferForMlStep(buf, stepId, ctx);
  if (cropped === buf) return file;
  return new File([new Uint8Array(cropped)], file.name || `${stepId}.jpg`, {
    type: "image/jpeg",
  });
}
