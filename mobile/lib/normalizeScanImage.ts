import {
  ImageManipulator,
  manipulateAsync,
  SaveFormat,
  FlipType,
} from "expo-image-manipulator";

/**
 * Match the WEB capture exactly so the inference service receives equivalent bytes:
 * web canvas exports the longest edge at 1280px, JPEG quality 0.82 (components/dashboard/FaceScanFlow.tsx).
 * Mobile previously uploaded full-resolution camera stills (often 3000–4000px) at 0.9, so the
 * model saw very different inputs than the website. These constants keep parity.
 */
const UPLOAD_MAX_EDGE = 1280;
const UPLOAD_JPEG_QUALITY = 0.82;

/**
 * Bake EXIF orientation into pixels and downscale to the same size/quality the web sends,
 * before upload (matches server sharp.rotate + web canvas export).
 */
export async function normalizeScanImageUri(uri: string): Promise<string> {
  // Use the legacy manipulateAsync pipeline: it normalizes EXIF orientation
  // BEFORE applying the resize, so a single-axis resize preserves aspect ratio.
  // The newer stateful manipulate().resize() API resizes against the
  // pre-orientation buffer, which stretched portrait selfies horizontally.
  let actions: Parameters<typeof manipulateAsync>[1] = [];
  try {
    // Empty action set still bakes EXIF orientation, so width/height here are
    // the upright display dimensions we should pick the resize axis from.
    const probe = await manipulateAsync(uri, []);
    const { width, height } = probe;
    if (width && height && (width > UPLOAD_MAX_EDGE || height > UPLOAD_MAX_EDGE)) {
      actions =
        width >= height
          ? [{ resize: { width: UPLOAD_MAX_EDGE } }]
          : [{ resize: { height: UPLOAD_MAX_EDGE } }];
    }
  } catch {
    /* if probe fails, fall through and just re-encode at parity quality */
  }

  const saved = await manipulateAsync(uri, actions, {
    format: SaveFormat.JPEG,
    compress: UPLOAD_JPEG_QUALITY,
  });
  return saved.uri;
}

/** Front-camera stills are unmirrored; flip so review/upload match the live selfie preview (web FaceScanFlow). */
export async function prepareCapturedScanPhotoUri(
  uri: string,
  facing: "front" | "back"
): Promise<string> {
  if (facing !== "front") return uri;
  const flipped = await ImageManipulator.manipulate(uri)
    .flip(FlipType.Horizontal)
    .renderAsync();
  const saved = await flipped.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.88,
  });
  return saved.uri;
}
