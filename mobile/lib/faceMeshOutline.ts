/** MediaPipe face mesh indices forming the face oval (closed loop). */
export const FACE_MESH_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162,
  21, 54, 103, 67, 109,
] as const;

export type NormalizedPoint = { x: number; y: number };

export function landmarkToPreviewNormalized(
  x: number,
  y: number,
  cropZoom: number
): NormalizedPoint {
  const z = Math.max(1, cropZoom);
  const offset = (1 - 1 / z) / 2;
  return { x: x / z + offset, y: y / z + offset };
}

export function faceOvalPolylinePoints(
  points: NormalizedPoint[],
  width: number,
  height: number,
  opts?: { mirrorX?: boolean; cropZoom?: number }
): Array<{ x: number; y: number }> | null {
  if (!points.length || width < 1 || height < 1) return null;
  const mirrorX = opts?.mirrorX ?? true;
  const cropZoom = opts?.cropZoom ?? 1;
  const out: Array<{ x: number; y: number }> = [];
  for (const idx of FACE_MESH_OVAL_INDICES) {
    const p = points[idx];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const mapped = landmarkToPreviewNormalized(p.x, p.y, cropZoom);
    const x = (mirrorX ? 1 - mapped.x : mapped.x) * width;
    const y = mapped.y * height;
    out.push({ x, y });
  }
  return out.length >= 10 ? out : null;
}
