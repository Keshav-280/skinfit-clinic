/** MediaPipe face mesh indices forming the face oval (closed loop). */
export const FACE_MESH_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162,
  21, 54, 103, 67, 109,
] as const;

export type NormalizedPoint = { x: number; y: number };

/**
 * Per-index EMA smoothing of the MediaPipe landmark array.
 * Reset is handled by passing `prev = null`. Falls back to `next` when arrays
 * have different lengths (camera switch / new face).
 */
export function smoothLandmarks(
  prev: NormalizedPoint[] | null,
  next: NormalizedPoint[] | null,
  alpha = 0.45
): NormalizedPoint[] | null {
  if (!next) return prev;
  if (!prev || prev.length !== next.length) return next;
  const out: NormalizedPoint[] = new Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    out[i] = {
      x: a.x * (1 - alpha) + b.x * alpha,
      y: a.y * (1 - alpha) + b.y * alpha,
    };
  }
  return out;
}

/** Map landmark coords (on zoom-cropped analysis frame) to full preview 0-1 space. */
export function landmarkToPreviewNormalized(
  x: number,
  y: number,
  cropZoom: number
): NormalizedPoint {
  const z = Math.max(1, cropZoom);
  const offset = (1 - 1 / z) / 2;
  return { x: x / z + offset, y: y / z + offset };
}

/** SVG path `d` for a closed red dotted face outline (viewBox 0 0 1 1). */
export function faceOvalPathFromLandmarks(
  points: NormalizedPoint[],
  opts?: { mirrorX?: boolean; cropZoom?: number }
): string | null {
  if (!points.length) return null;
  const mirrorX = opts?.mirrorX ?? false;
  const cropZoom = opts?.cropZoom ?? 1;
  const parts: string[] = [];
  let n = 0;
  for (const idx of FACE_MESH_OVAL_INDICES) {
    const p = points[idx];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const mapped = landmarkToPreviewNormalized(p.x, p.y, cropZoom);
    const x = mirrorX ? 1 - mapped.x : mapped.x;
    const y = mapped.y;
    parts.push(`${n === 0 ? "M" : "L"} ${x.toFixed(4)} ${y.toFixed(4)}`);
    n++;
  }
  if (n < 10) return null;
  return `${parts.join(" ")} Z`;
}
