import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import {
  computeFaceGuideCropInSourcePixels,
  MOBILE_FRONT_GUIDE_ELLIPSE,
  shouldCropToFaceGuide,
} from "../../src/lib/faceGuideCrop";

export type ViewfinderSize = { width: number; height: number };

/** Crop front-facing steps to a padded 3:4 rect around the dashed ellipse (not the full sensor still). */
export async function cropScanPhotoToFaceGuide(
  uri: string,
  stepId: FaceScanCaptureId,
  viewfinder: ViewfinderSize,
  opts?: { zoom?: number }
): Promise<string> {
  if (!shouldCropToFaceGuide(stepId)) return uri;
  if (viewfinder.width < 1 || viewfinder.height < 1) return uri;

  let probe: { width?: number; height?: number };
  try {
    probe = await manipulateAsync(uri, []);
  } catch {
    return uri;
  }

  const imgW = probe.width ?? 0;
  const imgH = probe.height ?? 0;
  if (!imgW || !imgH) return uri;

  const crop = computeFaceGuideCropInSourcePixels({
    sourceW: imgW,
    sourceH: imgH,
    viewfinderW: viewfinder.width,
    viewfinderH: viewfinder.height,
    zoom: opts?.zoom ?? 1,
    mirror: false,
    ellipse: MOBILE_FRONT_GUIDE_ELLIPSE,
  });
  if (!crop) return uri;

  const originX = Math.max(0, Math.min(Math.round(crop.x), imgW - 1));
  const originY = Math.max(0, Math.min(Math.round(crop.y), imgH - 1));
  const width = Math.max(1, Math.min(Math.round(crop.w), imgW - originX));
  const height = Math.max(1, Math.min(Math.round(crop.h), imgH - originY));

  try {
    const saved = await manipulateAsync(
      uri,
      [{ crop: { originX, originY, width, height } }],
      { compress: 0.88, format: SaveFormat.JPEG }
    );
    return saved.uri ?? uri;
  } catch {
    return uri;
  }
}
