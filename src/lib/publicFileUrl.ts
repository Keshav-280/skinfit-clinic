/**
 * Normalize stored file URLs for browser/mobile display.
 * Masks/overlays are saved with PUBLIC_UPLOAD_BASE_URL (absolute); use relative
 * `/api/files/...` in `<img src>` so session cookies work on any app host.
 */
export function publicFileDisplayUrl(
  urlOrPath: string | null | undefined
): string | undefined {
  if (!urlOrPath?.trim()) return undefined;
  const t = urlOrPath.trim();
  if (t.startsWith("data:") || t.startsWith("blob:")) return t;

  try {
    const u = new URL(t);
    if (u.pathname.startsWith("/api/files/")) {
      return `${u.pathname}${u.search}`;
    }
  } catch {
    /* not an absolute URL */
  }

  if (t.startsWith("/api/files/")) return t;

  if (/^(masks|scans|audio|attachments|reports)\//.test(t)) {
    const encoded = t.split("/").map(encodeURIComponent).join("/");
    return `/api/files/${encoded}`;
  }

  return t;
}

/** Storage key under LOCAL_STORAGE_ROOT (e.g. `scans/uuid.jpg`) from a saved ref. */
export function storageRelativePathFromRef(
  urlOrPath: string | null | undefined
): string | null {
  if (!urlOrPath?.trim()) return null;
  const t = urlOrPath.trim();
  if (t.startsWith("data:") || t.startsWith("blob:")) return null;

  if (/^(masks|scans|audio|attachments|reports)\//.test(t)) {
    return t.split("/").map(decodeURIComponent).join("/");
  }

  if (t.startsWith("/api/files/")) {
    return t
      .slice("/api/files/".length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
  }

  try {
    const u = new URL(t);
    if (u.pathname.startsWith("/api/files/")) {
      return u.pathname
        .slice("/api/files/".length)
        .split("/")
        .map(decodeURIComponent)
        .join("/");
    }
  } catch {
    /* not an absolute URL */
  }

  return null;
}
