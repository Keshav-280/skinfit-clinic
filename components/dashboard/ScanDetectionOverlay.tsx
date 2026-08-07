"use client";

import { useMemo } from "react";
import type { ConcernChipId } from "./ConcernChips";
import type {
  DetectionRegion,
  ProxyEllipse,
  ProxyPolyline,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";

const MERGE_DISTANCE_PCT = 8;
const POLYLINE_MERGE_DISTANCE_PCT = 3;
const SHORT_LINE_PCT = 6;

const PROXY_STROKE: Record<string, string> = {
  pigmentation: "#F59E0B",
  acne_scars: "#F97316",
  under_eye: "#3B82F6",
  sagging_volume: "#06B6D4",
};

function strokeForClass(cls: string, displayClass: string): string {
  const x = `${cls} ${displayClass}`.toLowerCase();
  if (
    x.includes("acne") ||
    x.includes("comedonal") ||
    x.includes("papule") ||
    x.includes("pustule") ||
    x.includes("nodule") ||
    x.includes("blackhead") ||
    x.includes("whitehead")
  ) {
    return "#dc2626";
  }
  if (x.includes("wrinkle")) return "#7c3aed";
  if (x.includes("pigment") || x.includes("melasma") || x.includes("dark spot"))
    return "#F59E0B";
  if (x.includes("under") || x.includes("eye") || x.includes("dark circle"))
    return "#3B82F6";
  if (x.includes("scar")) return "#F97316";
  if (x.includes("sag") || x.includes("volume")) return "#06B6D4";
  return "#6b7280";
}

function proxyStroke(cls: string): string {
  return PROXY_STROKE[cls] ?? strokeForClass(cls, cls);
}

function regionMatchesConcern(
  region: DetectionRegion,
  activeConcern: ConcernChipId
): boolean {
  if (activeConcern === "all") return true;
  const x = `${region.class} ${region.display_class}`.toLowerCase();
  if (activeConcern === "acne") {
    return (
      (x.includes("acne") ||
        x.includes("comedonal") ||
        x.includes("papule") ||
        x.includes("pustule") ||
        x.includes("nodule") ||
        x.includes("blackhead") ||
        x.includes("whitehead")) &&
      !x.includes("scar")
    );
  }
  if (activeConcern === "acne_scars") return x.includes("scar");
  if (activeConcern === "wrinkles") return x.includes("wrinkle");
  if (activeConcern === "pigmentation")
    return x.includes("pigment") || x.includes("melasma") || x.includes("dark spot");
  if (activeConcern === "under_eye")
    return x.includes("eye") || x.includes("dark circle") || x.includes("under");
  if (activeConcern === "sagging_volume")
    return x.includes("sag") || x.includes("volume") || x.includes("contour");
  return false;
}

function wrinkleMatchesConcern(activeConcern: ConcernChipId): boolean {
  return activeConcern === "all" || activeConcern === "wrinkles";
}

function proxyMatchesConcern(
  cls: string,
  activeConcern: ConcernChipId
): boolean {
  if (activeConcern === "all") return true;
  if (activeConcern === "pigmentation") return cls === "pigmentation";
  if (activeConcern === "acne_scars") return cls === "acne_scars";
  if (activeConcern === "under_eye") return cls === "under_eye";
  if (activeConcern === "sagging_volume") return cls === "sagging_volume";
  return false;
}

function proxyOpacity(
  score: number,
  matches: boolean,
  regionOpacity?: number,
  diffuse?: boolean
): number {
  if (!matches) return 0.08;
  if (typeof regionOpacity === "number" && Number.isFinite(regionOpacity)) {
    return regionOpacity;
  }
  if (diffuse) return 0.3;
  const s = Math.round(Math.max(1, Math.min(5, score)));
  if (s <= 2) return 0.35;
  if (s === 3) return 0.55;
  if (s === 4) return 0.75;
  return 0.9;
}

type MergedCircle = {
  key: string;
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  label: string;
  matches: boolean;
};

type MergedPolyline = {
  key: string;
  points: [number, number][];
  matches: boolean;
};

function mergeNearbyRegions(
  regions: DetectionRegion[],
  activeConcern: ConcernChipId
): MergedCircle[] {
  type Node = DetectionRegion & { used: boolean };
  const nodes: Node[] = regions.map((r) => ({ ...r, used: false }));
  const out: MergedCircle[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const seed = nodes[i]!;
    if (seed.used) continue;
    seed.used = true;
    const cluster: DetectionRegion[] = [seed];
    const groupKey = seed.display_class || seed.class;

    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < nodes.length; j++) {
        const cand = nodes[j]!;
        if (cand.used) continue;
        const candKey = cand.display_class || cand.class;
        if (candKey !== groupKey) continue;
        const nearAny = cluster.some((m) => {
          const dx = m.center_pct[0] - cand.center_pct[0];
          const dy = m.center_pct[1] - cand.center_pct[1];
          return Math.hypot(dx, dy) <= MERGE_DISTANCE_PCT;
        });
        if (nearAny) {
          cand.used = true;
          cluster.push(cand);
          grew = true;
        }
      }
    }

    const cx =
      cluster.reduce((s, r) => s + r.center_pct[0], 0) / cluster.length;
    const cy =
      cluster.reduce((s, r) => s + r.center_pct[1], 0) / cluster.length;
    let r = 0;
    for (const m of cluster) {
      const dist = Math.hypot(m.center_pct[0] - cx, m.center_pct[1] - cy);
      r = Math.max(r, dist + m.radius_pct);
    }
    r = Math.max(r, 0.8);

    const label = seed.display_class || seed.class;
    out.push({
      key: `${groupKey}-${i}-${cluster.length}`,
      cx,
      cy,
      r,
      stroke: strokeForClass(seed.class, seed.display_class),
      label,
      matches: regionMatchesConcern(seed, activeConcern),
    });
  }

  return out;
}

function polylineCentroid(line: WrinkleLine): [number, number] {
  const n = line.points_pct.length || 1;
  const sx = line.points_pct.reduce((s, p) => s + p[0], 0) / n;
  const sy = line.points_pct.reduce((s, p) => s + p[1], 0) / n;
  return [sx, sy];
}

function endpointDist(
  a: [number, number],
  b: [number, number]
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Chain two polylines by connecting nearest endpoints. */
function chainPoints(
  a: [number, number][],
  b: [number, number][]
): [number, number][] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const a0 = a[0]!;
  const a1 = a[a.length - 1]!;
  const b0 = b[0]!;
  const b1 = b[b.length - 1]!;
  const opts = [
    { d: endpointDist(a1, b0), pts: [...a, ...b] },
    { d: endpointDist(a1, b1), pts: [...a, ...[...b].reverse()] },
    { d: endpointDist(a0, b0), pts: [...[...a].reverse(), ...b] },
    { d: endpointDist(a0, b1), pts: [...[...a].reverse(), ...[...b].reverse()] },
  ];
  opts.sort((x, y) => x.d - y.d);
  return opts[0]!.pts;
}

/**
 * Merge short wrinkle polylines whose centroids are within 3% into smoother paths.
 */
function mergeNearbyPolylines(
  lines: WrinkleLine[],
  activeConcern: ConcernChipId
): MergedPolyline[] {
  const matches = wrinkleMatchesConcern(activeConcern);
  type Node = WrinkleLine & { used: boolean; centroid: [number, number] };
  const nodes: Node[] = lines.map((l) => ({
    ...l,
    used: false,
    centroid: polylineCentroid(l),
  }));
  const out: MergedPolyline[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const seed = nodes[i]!;
    if (seed.used) continue;
    seed.used = true;

    // Long lines stay alone; only cluster short ones together.
    if (seed.length_pct >= SHORT_LINE_PCT) {
      out.push({
        key: `wrinkle-long-${i}`,
        points: seed.points_pct,
        matches,
      });
      continue;
    }

    let points = [...seed.points_pct] as [number, number][];
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < nodes.length; j++) {
        const cand = nodes[j]!;
        if (cand.used) continue;
        if (cand.length_pct >= SHORT_LINE_PCT) continue;
        const dx = seed.centroid[0] - cand.centroid[0];
        const dy = seed.centroid[1] - cand.centroid[1];
        // Also allow merge if any endpoint is within 3% of another endpoint
        const nearCentroid =
          Math.hypot(dx, dy) <= POLYLINE_MERGE_DISTANCE_PCT;
        const nearEnd = points.some((p) =>
          cand.points_pct.some(
            (q) => endpointDist(p, q) <= POLYLINE_MERGE_DISTANCE_PCT
          )
        );
        if (nearCentroid || nearEnd) {
          cand.used = true;
          points = chainPoints(points, cand.points_pct);
          grew = true;
        }
      }
    }

    if (points.length >= 2) {
      out.push({
        key: `wrinkle-cluster-${i}-${points.length}`,
        points,
        matches,
      });
    }
  }

  return out;
}

export function ScanDetectionOverlay({
  regions = [],
  wrinkleLines = [],
  proxyRegions = [],
  activeConcern = "all",
  imageWidth: _imageWidth,
  imageHeight: _imageHeight,
}: {
  regions?: DetectionRegion[];
  /** Skeleton polylines for wrinkles (CureSkin-style dashed strokes). */
  wrinkleLines?: WrinkleLine[];
  /** Landmark-based proxy zones for params without pixel detectors. */
  proxyRegions?: ProxyRegion[];
  activeConcern?: ConcernChipId;
  imageWidth?: number;
  imageHeight?: number;
}) {
  const circles = useMemo(
    () => mergeNearbyRegions(regions, activeConcern),
    [regions, activeConcern]
  );
  const polylines = useMemo(
    () => mergeNearbyPolylines(wrinkleLines, activeConcern),
    [wrinkleLines, activeConcern]
  );

  const proxyEllipses = useMemo(
    () =>
      proxyRegions.filter(
        (r): r is ProxyEllipse => r.type === "ellipse"
      ),
    [proxyRegions]
  );
  const proxyPolylines = useMemo(
    () =>
      proxyRegions.filter(
        (r): r is ProxyPolyline => r.type === "polyline"
      ),
    [proxyRegions]
  );

  const hasProxy = proxyEllipses.length > 0 || proxyPolylines.length > 0;

  if (
    circles.length === 0 &&
    polylines.length === 0 &&
    !hasProxy
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full overflow-hidden"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <style>{`
          @keyframes scan-det-pulse {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
        {polylines.map((p) => (
          <polyline
            key={p.key}
            points={p.points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#7c3aed"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="transition-opacity duration-300 ease-out"
            style={{
              opacity: p.matches ? 1 : 0.15,
              animation: p.matches
                ? "scan-det-pulse 400ms ease-out both"
                : undefined,
            }}
          />
        ))}
        {proxyPolylines.map((p, i) => {
          const matches = proxyMatchesConcern(p.class, activeConcern);
          return (
            <polyline
              key={`proxy-line-${p.class}-${i}`}
              points={p.points_pct.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={proxyStroke(p.class)}
              strokeWidth={1}
              strokeDasharray="8 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="transition-opacity duration-300 ease-out"
              style={{
                opacity: proxyOpacity(p.score, matches, p.opacity),
              }}
            />
          );
        })}
        {circles.map((c) => (
          <circle
            key={c.key}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill="none"
            stroke={c.stroke}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
            className="transition-opacity duration-300 ease-out"
            style={{
              opacity: c.matches ? 1 : 0.15,
              animation: c.matches
                ? "scan-det-pulse 400ms ease-out both"
                : undefined,
            }}
          >
            <title>{c.label}</title>
          </circle>
        ))}
        {proxyEllipses.map((e, i) => {
          const matches = proxyMatchesConcern(e.class, activeConcern);
          const title =
            e.label ||
            (e.diffuse
              ? `Diffuse ${e.class.replace(/_/g, " ")}`
              : e.class.replace(/_/g, " "));
          return (
            <ellipse
              key={`proxy-ell-${e.class}-${i}`}
              cx={e.center_pct[0]}
              cy={e.center_pct[1]}
              rx={e.rx_pct}
              ry={e.ry_pct}
              fill="none"
              stroke={proxyStroke(e.class)}
              strokeWidth={1}
              strokeDasharray="8 4"
              vectorEffect="non-scaling-stroke"
              className="transition-opacity duration-300 ease-out"
              style={{
                opacity: proxyOpacity(
                  e.score,
                  matches,
                  e.opacity,
                  e.diffuse
                ),
              }}
            >
              <title>{title}</title>
            </ellipse>
          );
        })}
      </svg>
    </div>
  );
}
