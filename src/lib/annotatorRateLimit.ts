/** In-memory rate limit for heavy annotator state reads (single web replica). */
const buckets = new Map<string, number[]>();

export function allowAnnotatorHeavyGet(key: string, maxPerMinute = 12): boolean {
  const now = Date.now();
  const hits = buckets.get(key) ?? [];
  const recent = hits.filter((t) => now - t < 60_000);
  if (recent.length >= maxPerMinute) return false;
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export function annotatorClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
