/** Max bytes when pulling a remote scan image through our preview pipeline (SSRF-safe fetch). */
const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "0.0.0.0" ||
    h === "::1"
  ) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (![a, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
    return true;
  }
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Allow https (and http outside production) for same-origin-style image proxies; blocks obvious private hosts. */
export function isUrlSafeForServerSideImageFetch(href: string): boolean {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  if (u.protocol === "https:") {
    return !isBlockedHostname(u.hostname);
  }
  if (u.protocol === "http:" && process.env.NODE_ENV !== "production") {
    return !isBlockedHostname(u.hostname);
  }
  return false;
}

/**
 * Fetch remote image bytes for preview re-encoding. Returns null on failure / oversize / timeout.
 */
export async function fetchPublicImageToBuffer(url: string): Promise<Buffer | null> {
  if (!isUrlSafeForServerSideImageFetch(url)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (!res.ok) return null;
    const cl = res.headers.get("content-length");
    if (cl != null && cl !== "") {
      const n = Number(cl);
      if (Number.isFinite(n) && n > MAX_BYTES) return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
