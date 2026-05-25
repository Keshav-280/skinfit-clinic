/**
 * Lightweight head pose from five facial points (RetinaFace-style landmarks).
 * Normalized image coordinates (0–1), origin top-left.
 */

import type { HeadPoseDegrees } from "@/src/lib/faceCaptureTypes";

export type FiveFacePoints = {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  nose: { x: number; y: number };
  leftMouth: { x: number; y: number };
  rightMouth: { x: number; y: number };
};

const RAD2DEG = 180 / Math.PI;

export function headPoseFromFivePoints(pts: FiveFacePoints): HeadPoseDegrees {
  const le = pts.leftEye;
  const re = pts.rightEye;
  const nose = pts.nose;
  const lm = pts.leftMouth;
  const rm = pts.rightMouth;

  const eyeMidX = (le.x + re.x) / 2;
  const eyeMidY = (le.y + re.y) / 2;
  const interEye = Math.hypot(re.x - le.x, re.y - le.y) || 1e-6;
  const mouthMidY = (lm.y + rm.y) / 2;

  const yaw = ((nose.x - eyeMidX) / interEye) * 42;
  const pitch = ((nose.y - eyeMidY) / interEye) * 38 - 8;
  const roll = Math.atan2(re.y - le.y, re.x - le.x) * RAD2DEG;

  const faceH = Math.max(0.08, mouthMidY - eyeMidY);
  const pitchAdj = pitch + (nose.y - mouthMidY) / faceH * 12;

  return {
    yaw: clamp(yaw, -55, 55),
    pitch: clamp(pitchAdj, -40, 40),
    roll: clamp(roll, -35, 35),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Portrait-oriented bbox from detection box + optional vertical padding. */
export function portraitBoxFromPixelBbox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  frameW: number,
  frameH: number
): import("@/src/lib/faceCaptureTypes").NormalizedFaceBox {
  const w = Math.max(1, x2 - x1);
  const h = Math.max(1, y2 - y1);
  const padX = w * 0.04;
  const padTop = h * 0.12;
  const padBottom = h * 0.04;
  const nx = Math.max(0, (x1 - padX) / frameW);
  const ny = Math.max(0, (y1 - padTop) / frameH);
  const nw = Math.min(1 - nx, (w + padX * 2) / frameW);
  const nh = Math.min(1 - ny, (h + padTop + padBottom) / frameH);
  return { x: nx, y: ny, width: nw, height: nh };
}
