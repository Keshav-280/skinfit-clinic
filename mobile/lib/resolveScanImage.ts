import { apiUrl } from "./apiBase";

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

  const isPatientScanImage = (() => {
    try {
      const u = new URL(absolute);
      return /\/api\/patient\/scans\/\d+\/image$/.test(u.pathname);
    } catch {
      return (
        absolute.includes("/api/patient/scans/") &&
        /\/image(\?|$)/.test(absolute)
      );
    }
  })();
  if (token && isPatientScanImage) {
    return {
      uri: absolute,
      headers: { Authorization: `Bearer ${token}` },
    };
  }
  return { uri: absolute };
}

function stripPreviewFromPatientScanImageUrl(url: string): string {
  const t = url.trim();
  if (!t.includes("/api/patient/scans/") || !/\/image(\?|$)/.test(t)) {
    return t;
  }
  try {
    const u = new URL(t, "http://local.invalid");
    if (!/\/api\/patient\/scans\/\d+\/image$/.test(u.pathname)) return t;
    u.searchParams.delete("preview");
    u.searchParams.delete("thumb");
    const q = u.searchParams.toString();
    return q ? `${u.pathname}?${q}` : u.pathname;
  } catch {
    return t;
  }
}

/** Load bytes for HTML PDF (Expo Print cannot send auth headers on &lt;img&gt;). */
export async function embedScanImageForPdf(
  imageUrl: string,
  token: string | null
): Promise<string> {
  if (imageUrl.startsWith("data:")) return imageUrl;

  const fullUrl = stripPreviewFromPatientScanImageUrl(imageUrl);
  const { uri, headers } = resolveAuthenticatedScanImageSource(fullUrl, token);
  const res = await fetch(uri, { headers: headers ?? {} });
  if (!res.ok) {
    throw new Error("Could not load scan image for PDF.");
  }
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  return `data:${mime};base64,${b64}`;
}
