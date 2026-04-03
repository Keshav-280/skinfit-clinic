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

  const isPatientScanImage =
    absolute.includes("/api/patient/scans/") && absolute.endsWith("/image");
  if (token && isPatientScanImage) {
    return {
      uri: absolute,
      headers: { Authorization: `Bearer ${token}` },
    };
  }
  return { uri: absolute };
}

/** Load bytes for HTML PDF (Expo Print cannot send auth headers on &lt;img&gt;). */
export async function embedScanImageForPdf(
  imageUrl: string,
  token: string | null
): Promise<string> {
  if (imageUrl.startsWith("data:")) return imageUrl;

  const { uri, headers } = resolveAuthenticatedScanImageSource(imageUrl, token);
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
