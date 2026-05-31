/**
 * Legacy masks from matplotlib exports may bake a title band at the top.
 * @deprecated New scans use title-free JPEG overlays; kept for old history entries.
 */
import type { CSSProperties } from "react";
export const MASK_MATPLOTLIB_TITLE_CROP_RATIO = 0.13;

/** Face capture panels in scan reports (width / height). */
export const SCAN_FACE_FRAME_ASPECT = 3 / 4;
export const SCAN_FACE_FRAME_ASPECT_CSS = "3 / 4";

/** Mask overlay panels — square 224×224 inference output (width / height). */
export const SCAN_MASK_FRAME_ASPECT = 1;
export const SCAN_MASK_FRAME_ASPECT_CSS = "1 / 1";

/** Title-free JPEG overlays from `/analyze_dual_scan` (no matplotlib). */
export const MASK_EXPORT_VERSION_TITLE_FREE = 2;

export function maskExportVersionFromDataUri(
  dataUri: string | undefined
): number | undefined {
  if (!dataUri?.startsWith("data:image/")) return undefined;
  if (dataUri.startsWith("data:image/jpeg")) return MASK_EXPORT_VERSION_TITLE_FREE;
  if (dataUri.startsWith("data:image/png")) return 1;
  return undefined;
}

/** Legacy `/analyze_dual_scan` masks were matplotlib PNGs with a baked title band. */
export function maskLikelyHasMatplotlibTitle(src: string): boolean {
  const s = src.trim().toLowerCase();
  if (s.startsWith("data:image/png")) return true;
  return /\.png(?:[?#]|$)/i.test(s);
}

/** Crop baked matplotlib titles unless scan was saved with title-free mask export. */
export function shouldCropLegacyMaskTitle(
  _src: string,
  maskExportVersion?: number | null
): boolean {
  return maskExportVersion !== MASK_EXPORT_VERSION_TITLE_FREE;
}

/** Percent height/top to clip the matplotlib title band inside a square frame. */
export function legacyMaskTitleCropPercents(
  ratio = MASK_MATPLOTLIB_TITLE_CROP_RATIO
): { heightPct: number; topPct: number } {
  const visible = 1 - ratio;
  return {
    heightPct: (1 / visible) * 100,
    topPct: (-ratio / visible) * 100,
  };
}

export function legacyMaskTitleCropStyle(
  ratio = MASK_MATPLOTLIB_TITLE_CROP_RATIO
): CSSProperties {
  const { heightPct, topPct } = legacyMaskTitleCropPercents(ratio);
  return {
    position: "absolute",
    left: 0,
    width: "100%",
    height: `${heightPct}%`,
    top: `${topPct}%`,
    objectFit: "cover",
    objectPosition: "center",
  };
}
