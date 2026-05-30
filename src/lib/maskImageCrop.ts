/**
 * Inference masks from Python/matplotlib may bake a title band at the top.
 * Crop that band in UI and show a clean caption underneath instead.
 * @deprecated Prefer SCAN_FACE_FRAME_ASPECT — masks now use the same 3:4 frame as captures.
 */
export const MASK_MATPLOTLIB_TITLE_CROP_RATIO = 0.11;

/** Face capture + mask panels in scan reports (width / height). */
export const SCAN_FACE_FRAME_ASPECT = 3 / 4;
export const SCAN_FACE_FRAME_ASPECT_CSS = "3 / 4";
