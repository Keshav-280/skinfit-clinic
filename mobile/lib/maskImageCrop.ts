/** Mirrors `src/lib/maskImageCrop.ts` for Expo. */

import type { ImageStyle } from "react-native";

export const SCAN_FACE_FRAME_ASPECT = 3 / 4;
export const SCAN_MASK_FRAME_ASPECT = SCAN_FACE_FRAME_ASPECT;

export const MASK_MATPLOTLIB_TITLE_CROP_RATIO = 0.13;
export const MASK_EXPORT_VERSION_TITLE_FREE = 2;

export function maskLikelyHasMatplotlibTitle(src: string): boolean {
  const s = src.trim().toLowerCase();
  if (s.startsWith("data:image/png")) return true;
  return /\.png(?:[?#]|$)/i.test(s);
}

export function shouldCropLegacyMaskTitle(
  _src: string,
  maskExportVersion?: number | null
): boolean {
  return maskExportVersion !== MASK_EXPORT_VERSION_TITLE_FREE;
}

export function legacyMaskTitleCropPercents(
  ratio = MASK_MATPLOTLIB_TITLE_CROP_RATIO
): { heightPct: number; topPct: number } {
  const visible = 1 - ratio;
  return {
    heightPct: (1 / visible) * 100,
    topPct: (-ratio / visible) * 100,
  };
}

export function legacyMaskTitleCropImageStyle(
  ratio = MASK_MATPLOTLIB_TITLE_CROP_RATIO
): ImageStyle {
  const { heightPct, topPct } = legacyMaskTitleCropPercents(ratio);
  return {
    position: "absolute",
    left: 0,
    width: "100%",
    height: `${heightPct}%`,
    top: `${topPct}%`,
  };
}
