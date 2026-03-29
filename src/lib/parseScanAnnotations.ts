import type { ReportRegion } from "@/components/dashboard/scanReportTypes";

export function parseScanRegions(raw: unknown): ReportRegion[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportRegion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const issue = typeof o.issue === "string" ? o.issue : "Finding";
    const c = o.coordinates;
    if (!c || typeof c !== "object") continue;
    const cx = (c as Record<string, unknown>).x;
    const cy = (c as Record<string, unknown>).y;
    if (typeof cx === "number" && typeof cy === "number") {
      out.push({ issue, coordinates: { x: cx, y: cy } });
    }
  }
  return out;
}
