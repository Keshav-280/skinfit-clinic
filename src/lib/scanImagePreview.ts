import sharp from "sharp";

const PREVIEW_MAX_EDGE = 960;
const PREVIEW_JPEG_QUALITY = 78;
/** Stored face captures (R2/local) — matches web canvas + mobile normalizeScanImageUri. */
export const SCAN_UPLOAD_MAX_EDGE = 1280;
export const SCAN_UPLOAD_JPEG_QUALITY = 82;
/** Treatment-history cards: smaller file for faster load on mobile / list. */
const LIST_THUMB_MAX_EDGE = 480;
const LIST_THUMB_JPEG_QUALITY = 70;

export type PreviewJpegOpts = {
  maxEdge?: number;
  quality?: number;
};

/** Downscale for report/list thumbnails; keeps aspect ratio. */
/** Apply EXIF orientation and return upright JPEG bytes (for inference + storage). */
export async function bufferToOrientedJpegBuffer(
  input: Buffer,
  quality = 92
): Promise<Buffer> {
  return sharp(input).rotate().jpeg({ quality, mozjpeg: true }).toBuffer();
}

export async function bufferToPreviewJpegBuffer(
  input: Buffer,
  opts?: PreviewJpegOpts
): Promise<Buffer> {
  const maxEdge = opts?.maxEdge ?? PREVIEW_MAX_EDGE;
  const quality = opts?.quality ?? PREVIEW_JPEG_QUALITY;
  return sharp(input)
    .rotate()
    .resize(maxEdge, maxEdge, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/** Stronger compression + smaller longest edge for progress-tracker cover images. */
export function listThumbnailJpegOpts(): PreviewJpegOpts {
  return { maxEdge: LIST_THUMB_MAX_EDGE, quality: LIST_THUMB_JPEG_QUALITY };
}

export async function buildPreviewJpegDataUri(input: Buffer): Promise<string> {
  const buf = await bufferToPreviewJpegBuffer(input);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
