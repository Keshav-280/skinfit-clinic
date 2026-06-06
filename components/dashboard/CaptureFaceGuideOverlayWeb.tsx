"use client";

import type { FaceScanCaptureId } from "@/src/lib/faceScanCaptures";

type GuidePose = "front" | "left" | "right";

function poseForStep(stepId: FaceScanCaptureId): GuidePose {
  if (stepId === "left") return "left";
  if (stepId === "right") return "right";
  return "front";
}

const DASH = "8 10";
const STROKE = {
  fill: "none",
  stroke: "white",
  strokeWidth: 3,
  strokeDasharray: DASH,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
  opacity: 0.7,
};

function FrontGuide() {
  return (
    <>
      <ellipse cx="50" cy="50" rx="42" ry="52" {...STROKE} />
      <path
        d="M 24 92 Q 14 103 10 100 M 76 92 Q 86 103 90 100"
        {...STROKE}
      />
    </>
  );
}

/** Profile face outline — scaled from original to match front guide size. */
const LEFT_PROFILE_FACE =
  "M 62 34 C 54 24 40 26 34 38 C 30 48 31 58 36 66 C 41 74 50 76 56 70 C 61 64 64 52 62 34 Z";

const PROFILE_FACE_SCALE = 2.15;
const PROFILE_SHIFT_X = 10;
const PROFILE_SHIFT_Y = 4;

function LeftProfileGuide() {
  return (
    <g transform={`translate(${PROFILE_SHIFT_X},${PROFILE_SHIFT_Y})`}>
      <g transform={`translate(50,50) scale(${PROFILE_FACE_SCALE}) translate(-50,-50)`}>
        <path d={LEFT_PROFILE_FACE} {...STROKE} />
      </g>
      <path d="M 22 88 Q 10 104 8 101" {...STROKE} />
    </g>
  );
}

function RightProfileGuide() {
  return (
    <g transform={`translate(${-PROFILE_SHIFT_X},${PROFILE_SHIFT_Y})`}>
      <g transform={`translate(50,50) scale(${-PROFILE_FACE_SCALE},${PROFILE_FACE_SCALE}) translate(-50,-50)`}>
        <path d={LEFT_PROFILE_FACE} {...STROKE} />
      </g>
      <path d="M 78 88 Q 90 104 92 101" {...STROKE} />
    </g>
  );
}

type Props = {
  stepId: FaceScanCaptureId;
};

/** Figma-style dashed face / profile guide inside the viewfinder. */
export function CaptureFaceGuideOverlayWeb({ stepId }: Props) {
  const pose = poseForStep(stepId);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {pose === "front" ? <FrontGuide /> : null}
      {pose === "left" ? <LeftProfileGuide /> : null}
      {pose === "right" ? <RightProfileGuide /> : null}
    </svg>
  );
}
