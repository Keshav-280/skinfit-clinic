import { apiUrl } from "./apiBase";

/** Absolute API URL for fetch/download helpers. */
export function toAbsoluteApiUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      const u = new URL(t);
      if (u.pathname.startsWith("/api/files/")) {
        return apiUrl(`${u.pathname}${u.search}`);
      }
    } catch {
      /* keep absolute */
    }
    return t;
  }
  return apiUrl(t.startsWith("/") ? t : `/${t}`);
}

/** List/detail APIs return `/api/patient/scans/:id/image` instead of huge data URLs. */
export function resolveAuthenticatedScanImageSource(
  imageUrl: string,
  token: string | null
): { uri: string; headers?: Record<string, string> } {
  if (
    imageUrl.startsWith("data:") ||
    imageUrl.startsWith("file:") ||
    imageUrl.startsWith("content:")
  ) {
    return { uri: imageUrl };
  }

  const absolute =
    imageUrl.startsWith("http://") || imageUrl.startsWith("https://")
      ? imageUrl
      : apiUrl(imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`);

  if (token && requiresBearerAuthForImage(absolute)) {
    return {
      uri: absolute,
      headers: { Authorization: `Bearer ${token}` },
    };
  }
  return { uri: absolute };
}

export function requiresBearerAuthForImage(absoluteOrPath: string): boolean {
  const t = absoluteOrPath.trim();
  try {
    const u = new URL(
      t.startsWith("http") ? t : `http://local.invalid${t.startsWith("/") ? t : `/${t}`}`
    );
    if (/\/api\/patient\/scans\/\d+\/image$/.test(u.pathname)) return true;
    if (u.pathname.startsWith("/api/files/")) return true;
    return false;
  } catch {
    return (
      (t.includes("/api/patient/scans/") && /\/image(\?|$)/.test(t)) ||
      t.includes("/api/files/")
    );
  }
}

function stripPreviewFromPatientScanImageUrl(url: string): string {
  const t = url.trim();
  if (!t.includes("/api/patient/scans/") || !/\/image(\?|$)/.test(t)) {
    return t;
  }
  try {
    const u = new URL(
      t.startsWith("http") ? t : `http://local.invalid${t.startsWith("/") ? t : `/${t}`}`
    );
    if (!/\/api\/patient\/scans\/\d+\/image$/.test(u.pathname)) return t;
    u.searchParams.delete("preview");
    u.searchParams.delete("thumb");
    const q = u.searchParams.toString();
    const path = u.pathname;
    if (t.startsWith("http")) {
      const origin = u.origin;
      return q ? `${origin}${path}?${q}` : `${origin}${path}`;
    }
    return q ? `${path}?${q}` : path;
  } catch {
    return t;
  }
}

export { embedScanImageForPdf } from "./fetchAuthenticatedScanImage";
