export type PatientScanImageOpts = {
  /** Face-capture index; omit or 0 for primary. */
  index?: number;
  /** Smaller JPEG for lists and on-screen report (adds `preview=1`). */
  preview?: boolean;
  /** Extra-small cover for history list cards (`thumb=1`); use with `preview`. */
  thumbnail?: boolean;
};

/** Cookie- or Bearer-authenticated image bytes for dashboard / mobile list + detail. */
export function patientScanImagePath(
  scanId: number,
  opts?: PatientScanImageOpts
): string {
  const base = `/api/patient/scans/${scanId}/image`;
  const p = new URLSearchParams();
  if (opts?.index != null && opts.index > 0) {
    p.set("i", String(opts.index));
  }
  if (opts?.preview) {
    p.set("preview", "1");
  }
  if (opts?.preview && opts?.thumbnail) {
    p.set("thumb", "1");
  }
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

/**
 * Prefer for on-screen image source: adds `preview=1` so the API serves a downscaled JPEG.
 * Omit for PDF/embed flows that need full resolution.
 */
export function patientScanImageDisplayUrl(imageApiPathOrUrl: string): string {
  const t = imageApiPathOrUrl.trim();
  if (!t.includes("/api/patient/scans/") || !/\/image(\?|$)/.test(t)) {
    return t;
  }
  if (/[?&]preview=1(?:&|$)/.test(t) || /[?&]preview=true(?:&|$)/i.test(t)) {
    return t;
  }
  return t.includes("?") ? `${t}&preview=1` : `${t}?preview=1`;
}
