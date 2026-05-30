import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";

import { patientScanImageDisplayUrl } from "./patientScanImagePath";
import {
  resolveAuthenticatedScanImageSource,
} from "./resolveScanImage";

const uriCache = new Map<string, string>();

function cacheKey(uri: string, token: string | null): string {
  return `${token ?? ""}::${uri}`;
}

function hashUri(uri: string): string {
  let h = 0;
  for (let i = 0; i < uri.length; i++) {
    h = (h * 31 + uri.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function extensionFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Download an API image with Bearer auth and cache under `file://` for RN `<Image>`.
 * React Native often ignores `Authorization` on `Image` sources — use this for reports.
 */
export async function fetchAuthenticatedScanImageUri(
  imageUrl: string,
  token: string | null,
  opts?: { preview?: boolean }
): Promise<string> {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    throw new Error("Missing image URL.");
  }
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("content:")
  ) {
    return trimmed;
  }

  const displayUrl =
    opts?.preview === false
      ? trimmed
      : patientScanImageDisplayUrl(trimmed);
  const { uri, headers } = resolveAuthenticatedScanImageSource(
    displayUrl,
    token
  );

  const key = cacheKey(uri, token);
  const cached = uriCache.get(key);
  if (cached) {
    const info = await FileSystem.getInfoAsync(cached);
    if (info.exists) return cached;
    uriCache.delete(key);
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error("Device cache is unavailable.");
  }

  const localPath = `${cacheDir}scan-img-${hashUri(uri)}.${extensionFromMime("image/jpeg")}`;
  const existing = await FileSystem.getInfoAsync(localPath);
  if (existing.exists) {
    uriCache.set(key, localPath);
    return localPath;
  }

  const result = await FileSystem.downloadAsync(uri, localPath, {
    headers: headers ?? {},
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Image load failed (HTTP ${result.status}).`);
  }
  uriCache.set(key, result.uri);
  return result.uri;
}

/** Base64 data URI for expo-print HTML (cannot attach auth headers on `<img>`). */
export async function embedScanImageForPdf(
  imageUrl: string,
  token: string | null
): Promise<string> {
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("data:")) return trimmed;

  const { uri, headers } = resolveAuthenticatedScanImageSource(trimmed, token);
  const res = await fetch(uri, { headers: headers ?? {} });
  if (!res.ok) {
    throw new Error(`Could not load image for PDF (HTTP ${res.status}).`);
  }
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const buf = await res.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${mime};base64,${b64}`;
}

export { toAbsoluteApiUrl } from "./resolveScanImage";
