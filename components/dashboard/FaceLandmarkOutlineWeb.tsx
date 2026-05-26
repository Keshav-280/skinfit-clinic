"use client";

import { faceOvalPathFromLandmarks, type NormalizedPoint } from "@/src/lib/faceMeshOutline";

type Props = {
  landmarks: NormalizedPoint[] | null;
  /** Matches front-camera `scaleX(-1)` on the video. */
  mirrored?: boolean;
  cropZoom?: number;
};

export function FaceLandmarkOutlineWeb({
  landmarks,
  mirrored = false,
  cropZoom = 1,
}: Props) {
  const d = landmarks
    ? faceOvalPathFromLandmarks(landmarks, { mirrorX: mirrored, cropZoom })
    : null;
  if (!d) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="#ef4444"
        strokeWidth={3}
        strokeDasharray="8 6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.95}
      />
    </svg>
  );
}
