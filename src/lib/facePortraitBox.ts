/**
 * Portrait face bounds from MediaPipe landmarks - hairline to chin, cheek width (no shoulders).
 */

export type NormalizedFaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Face mesh indices (468-point) for a tight head portrait crop. */
const PORTRAIT_TOP = [10, 338, 297, 332, 284, 251];
/** Chin / lower jaw only - avoid neck landmarks that trigger false "shoulders" warnings. */
const PORTRAIT_BOTTOM = [152, 175, 199, 200];
const PORTRAIT_LEFT = [234, 127, 162, 21, 54, 93];
const PORTRAIT_RIGHT = [454, 356, 389, 251, 284, 323, 361];

function pickPoints(
  points: Array<{ x: number; y: number }>,
  indices: number[]
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const i of indices) {
    const p = points[i];
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out.push(p);
  }
  return out;
}

/** Hairline → chin with minimal side padding (not full mesh rectangle). */
export function facePortraitBoxFromLandmarks(
  points: Array<{ x: number; y: number }>
): NormalizedFaceBox | null {
  if (points.length < 300) return null;

  const topPts = pickPoints(points, PORTRAIT_TOP);
  const bottomPts = pickPoints(points, PORTRAIT_BOTTOM);
  const leftPts = pickPoints(points, PORTRAIT_LEFT);
  const rightPts = pickPoints(points, PORTRAIT_RIGHT);
  if (topPts.length < 1 || bottomPts.length < 1) return null;

  let minY = Math.min(...topPts.map((p) => p.y));
  let maxY = Math.max(...bottomPts.map((p) => p.y));
  const xCandidates = [...leftPts, ...rightPts, ...topPts, ...bottomPts];
  if (xCandidates.length < 4) return null;

  let minX = Math.min(...xCandidates.map((p) => p.x));
  let maxX = Math.max(...xCandidates.map((p) => p.x));

  const faceH = Math.max(0.08, maxY - minY);
  const faceW = Math.max(0.06, maxX - minX);

  // Room for hair above brow; minimal chin pad (no neck).
  minY = Math.max(0, minY - faceH * 0.12);
  maxY = Math.min(1, maxY + faceH * 0.01);
  const padX = faceW * 0.04;
  minX = Math.max(0, minX - padX);
  maxX = Math.min(1, maxX + padX);

  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 0.04 || height < 0.06) return null;

  return { x: minX, y: minY, width, height };
}

/** Fallback: axis-aligned bounds on all points with light padding. */
export function faceBoxFromAllLandmarks(
  points: Array<{ x: number; y: number }>
): NormalizedFaceBox | null {
  if (!points.length) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const padX = (maxX - minX) * 0.03;
  const padY = (maxY - minY) * 0.04;
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  return {
    x,
    y,
    width: Math.min(1 - x, maxX - minX + padX * 2),
    height: Math.min(1 - y, maxY - minY + padY * 2),
  };
}

export function faceBoxFromLandmarkPoints(
  points: Array<{ x: number; y: number }>
): NormalizedFaceBox | null {
  return (
    facePortraitBoxFromLandmarks(points) ?? faceBoxFromAllLandmarks(points)
  );
}
