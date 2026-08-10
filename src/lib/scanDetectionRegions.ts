/**
 * Percentage-based lesion / concern regions from acne-detector-v1 (and future heads).
 * Coordinates are relative to the source image so the frontend can overlay any size.
 */

export type DetectionRegion = {
  class: string;
  display_class: string;
  confidence: number;
  /** [x%, y%] of image width/height */
  center_pct: [number, number];
  radius_pct: number;
  /** [x1%, y1%, x2%, y2%] */
  bbox_pct: [number, number, number, number];
};

/** Wrinkle skeleton polylines extracted from mask vs source photo. */
export type WrinkleLine = {
  type: "polyline";
  class: string;
  points_pct: [number, number][];
  length_pct: number;
};

/** Landmark + attention proxy ellipse (pigmentation / scars / under-eye). */
export type ProxyEllipse = {
  type: "ellipse";
  class: "pigmentation" | "acne_scars" | "under_eye" | string;
  center_pct: [number, number];
  rx_pct: number;
  ry_pct: number;
  score: number;
  /** Conservative display opacity from extractor (0.3–0.9). */
  opacity?: number;
  /** Evenly spread issue — full-face subtle outline. */
  diffuse?: boolean;
  /** Tooltip / title, e.g. "Diffuse pigmentation". */
  label?: string;
  zone_activation?: number;
  proxy: true;
};

/** Landmark + attention proxy polyline (sagging & volume). */
export type ProxyPolyline = {
  type: "polyline";
  class: "sagging_volume" | string;
  points_pct: [number, number][];
  score: number;
  opacity?: number;
  zone_activation?: number;
  proxy: true;
};

export type ProxyRegion = ProxyEllipse | ProxyPolyline;

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parsePctPair(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length < 2) return null;
  const a = asFiniteNumber(v[0]);
  const b = asFiniteNumber(v[1]);
  if (a == null || b == null) return null;
  return [a, b];
}

function parsePctQuad(v: unknown): [number, number, number, number] | null {
  if (!Array.isArray(v) || v.length < 4) return null;
  const a = asFiniteNumber(v[0]);
  const b = asFiniteNumber(v[1]);
  const c = asFiniteNumber(v[2]);
  const d = asFiniteNumber(v[3]);
  if (a == null || b == null || c == null || d == null) return null;
  return [a, b, c, d];
}

export function parseDetectionRegion(raw: unknown): DetectionRegion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const cls = typeof o.class === "string" ? o.class.trim() : "";
  if (!cls) return null;
  const display =
    typeof o.display_class === "string" && o.display_class.trim()
      ? o.display_class.trim()
      : cls;
  const confidence = asFiniteNumber(o.confidence) ?? 0;
  const center = parsePctPair(o.center_pct);
  const radius = asFiniteNumber(o.radius_pct);
  const bbox = parsePctQuad(o.bbox_pct);
  if (!center || radius == null || !bbox) return null;
  return {
    class: cls,
    display_class: display,
    confidence,
    center_pct: center,
    radius_pct: Math.max(0.15, radius),
    bbox_pct: bbox,
  };
}

export function parseWrinkleLine(raw: unknown): WrinkleLine | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.type != null && o.type !== "polyline") return null;
  const cls =
    typeof o.class === "string" && o.class.trim() ? o.class.trim() : "wrinkles";
  if (!Array.isArray(o.points_pct) || o.points_pct.length < 2) return null;
  const points: [number, number][] = [];
  for (const p of o.points_pct) {
    const pair = parsePctPair(p);
    if (!pair) return null;
    points.push(pair);
  }
  if (points.length < 2) return null;
  const length = asFiniteNumber(o.length_pct) ?? 0;
  return {
    type: "polyline",
    class: cls,
    points_pct: points,
    length_pct: Math.max(0, length),
  };
}

/** Reads `scans.scores.detection_regions` (or circle items in annotation_regions). */
export function parseScanDetectionRegions(scores: unknown): DetectionRegion[] {
  if (!scores) return [];
  let list: unknown = scores;
  if (scores && typeof scores === "object" && !Array.isArray(scores)) {
    const root = scores as Record<string, unknown>;
    list = root.detection_regions;
    if (!Array.isArray(list) && Array.isArray(root.annotation_regions)) {
      list = root.annotation_regions.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          (item as Record<string, unknown>).type === "circle" &&
          (item as Record<string, unknown>).proxy !== true
      );
    }
  }
  if (!Array.isArray(list)) return [];
  const out: DetectionRegion[] = [];
  for (const item of list) {
    const parsed = parseDetectionRegion(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Reads `scans.scores.detection_regions_by_pose` → { poseId: DetectionRegion[] }. */
export function parseScanDetectionRegionsByPose(
  scores: unknown
): Record<string, DetectionRegion[]> {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return {};
  const raw = (scores as Record<string, unknown>).detection_regions_by_pose;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, DetectionRegion[]> = {};
  for (const [pose, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const parsed: DetectionRegion[] = [];
    for (const item of list) {
      const p = parseDetectionRegion(item);
      if (p) parsed.push(p);
    }
    if (parsed.length > 0) out[pose] = parsed;
  }
  return out;
}

/** Reads `scans.scores.wrinkle_lines`. */
export function parseScanWrinkleLines(scores: unknown): WrinkleLine[] {
  if (!scores) return [];
  let list: unknown = scores;
  if (scores && typeof scores === "object" && !Array.isArray(scores)) {
    list = (scores as Record<string, unknown>).wrinkle_lines;
  }
  if (!Array.isArray(list)) return [];
  const out: WrinkleLine[] = [];
  for (const item of list) {
    const parsed = parseWrinkleLine(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function parseProxyRegion(raw: unknown): ProxyRegion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.proxy !== true) return null;
  const cls =
    typeof o.class === "string" && o.class.trim() ? o.class.trim() : "";
  if (!cls) return null;
  const score = asFiniteNumber(o.score);
  if (score == null) return null;

  if (o.type === "ellipse") {
    const center = parsePctPair(o.center_pct);
    const rx = asFiniteNumber(o.rx_pct);
    const ry = asFiniteNumber(o.ry_pct);
    if (!center || rx == null || ry == null) return null;
    const opacity = asFiniteNumber(o.opacity);
    const zoneAct = asFiniteNumber(o.zone_activation);
    const label =
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
    return {
      type: "ellipse",
      class: cls,
      center_pct: center,
      rx_pct: Math.max(0.5, rx),
      ry_pct: Math.max(0.5, ry),
      score: Math.max(1, Math.min(5, score)),
      ...(opacity != null ? { opacity: Math.max(0.05, Math.min(1, opacity)) } : {}),
      ...(o.diffuse === true ? { diffuse: true as const } : {}),
      ...(label ? { label } : {}),
      ...(zoneAct != null ? { zone_activation: zoneAct } : {}),
      proxy: true,
    };
  }

  if (o.type === "polyline") {
    if (!Array.isArray(o.points_pct) || o.points_pct.length < 2) return null;
    const points: [number, number][] = [];
    for (const p of o.points_pct) {
      const pair = parsePctPair(p);
      if (!pair) return null;
      points.push(pair);
    }
    if (points.length < 2) return null;
    const opacity = asFiniteNumber(o.opacity);
    const zoneAct = asFiniteNumber(o.zone_activation);
    return {
      type: "polyline",
      class: cls,
      points_pct: points,
      score: Math.max(1, Math.min(5, score)),
      ...(opacity != null ? { opacity: Math.max(0.05, Math.min(1, opacity)) } : {}),
      ...(zoneAct != null ? { zone_activation: zoneAct } : {}),
      proxy: true,
    };
  }

  return null;
}

/** Reads `scans.scores.proxy_regions`, falling back to proxy items in `annotation_regions`. */
export function parseScanProxyRegions(scores: unknown): ProxyRegion[] {
  if (!scores) return [];
  let list: unknown = scores;
  if (scores && typeof scores === "object" && !Array.isArray(scores)) {
    const root = scores as Record<string, unknown>;
    list = root.proxy_regions;
    if (!Array.isArray(list) && Array.isArray(root.annotation_regions)) {
      list = root.annotation_regions;
    }
  }
  if (!Array.isArray(list)) return [];
  const out: ProxyRegion[] = [];
  for (const item of list) {
    const parsed = parseProxyRegion(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Unified annotation blob for persistence (circles + wrinkles + proxies). */
export function buildAnnotationRegions(
  detectionRegions: DetectionRegion[] = [],
  wrinkleLines: WrinkleLine[] = [],
  proxyRegions: ProxyRegion[] = []
): unknown[] {
  return [
    ...detectionRegions.map((r) => ({
      type: "circle" as const,
      proxy: false as const,
      ...r,
    })),
    ...wrinkleLines.map((w) => ({
      ...w,
      proxy: false as const,
    })),
    ...proxyRegions,
  ];
}
