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

/** Legacy `/analyze_dual_scan` masks were matplotlib PNGs with a baked title band. */
export function maskLikelyHasMatplotlibTitle(src: string): boolean {
  const s = src.trim().toLowerCase();
  if (s.startsWith("data:image/png")) return true;
  return /\.png(?:[?#]|$)/i.test(s);
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
