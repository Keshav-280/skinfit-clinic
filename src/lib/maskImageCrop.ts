/**
 * Legacy masks from matplotlib exports may bake a title band at the top.
 * @deprecated New scans use title-free JPEG overlays; kept for old history entries.
 */
export const MASK_MATPLOTLIB_TITLE_CROP_RATIO = 0.11;

/** Face capture panels in scan reports (width / height). */
export const SCAN_FACE_FRAME_ASPECT = 3 / 4;
export const SCAN_FACE_FRAME_ASPECT_CSS = "3 / 4";

/** Mask overlay panels — square 224×224 inference output (width / height). */
export const SCAN_MASK_FRAME_ASPECT = 1;
export const SCAN_MASK_FRAME_ASPECT_CSS = "1 / 1";
