/**
 * Resolve scan image references — supports legacy data URIs and new file URLs.
 */

export type FaceCaptureRef = {
  label: string;
  imageUrl?: string;
  dataUri?: string;
  previewUrl?: string;
  previewDataUri?: string;
};

export function resolveCaptureImageSrc(
  ref: FaceCaptureRef,
  preferPreview = false
): string | null {
  if (preferPreview) {
    return ref.previewUrl ?? ref.previewDataUri ?? ref.imageUrl ?? ref.dataUri ?? null;
  }
  return ref.imageUrl ?? ref.dataUri ?? null;
}

export function resolveScoresOverlayUrl(scores: {
  overlayUrl?: string;
  overlayDataUri?: string;
  wrinkleMaskUrl?: string;
  wrinkleMaskDataUri?: string;
  acneMaskUrl?: string;
  acneMaskDataUri?: string;
} | null | undefined): {
  overlay: string | null;
  wrinkleMask: string | null;
  acneMask: string | null;
} {
  if (!scores) {
    return { overlay: null, wrinkleMask: null, acneMask: null };
  }
  return {
    overlay: scores.overlayUrl ?? scores.overlayDataUri ?? null,
    wrinkleMask: scores.wrinkleMaskUrl ?? scores.wrinkleMaskDataUri ?? null,
    acneMask: scores.acneMaskUrl ?? scores.acneMaskDataUri ?? null,
  };
}

/** Persist mask/overlay bytes to storage; returns URL path only. */
export async function persistDataUriToStorage(
  dataUri: string | undefined,
  kind: "masks" | "scans",
  upload: (
    k: "masks" | "scans",
    name: string,
    buf: Buffer,
    mime: string
  ) => Promise<{ path: string; url: string }>
): Promise<string | undefined> {
  if (!dataUri?.startsWith("data:")) return undefined;
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUri);
  if (!m) return undefined;
  const mime = m[1] || "image/jpeg";
  const buf = Buffer.from(m[2], "base64");
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : "jpg";
  const { url } = await upload(kind, `mask-${Date.now()}.${ext}`, buf, mime);
  return url;
}
