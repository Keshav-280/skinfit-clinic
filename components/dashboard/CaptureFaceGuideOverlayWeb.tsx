"use client";

import type { FaceScanCaptureId } from "@/src/lib/faceScanCaptures";

type GuidePose = "front" | "left" | "right";

function poseForStep(stepId: FaceScanCaptureId): GuidePose {
  if (stepId === "left") return "left";
  if (stepId === "right") return "right";
  return "front";
}

const DASH = "2.5 4.5";
const STROKE = {
  fill: "none",
  stroke: "white",
  strokeWidth: 2.25,
  strokeDasharray: DASH,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  opacity: 0.95,
};

function CornerMarks() {
  const c = "rgba(255,255,255,0.9)";
  const len = 14;
  const inset = 10;
  return (
    <>
      <path d={`M ${inset} ${inset + len} L ${inset} ${inset} L ${inset + len} ${inset}`} stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={`M ${100 - inset - len} ${inset} L ${100 - inset} ${inset} L ${100 - inset} ${inset + len}`} stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={`M ${inset} ${100 - inset - len} L ${inset} ${100 - inset} L ${inset + len} ${100 - inset}`} stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={`M ${100 - inset - len} ${100 - inset} L ${100 - inset} ${100 - inset} L ${100 - inset} ${100 - inset - len}`} stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  );
}

function FrontGuide() {
  return (
    <>
      <ellipse cx="50" cy="38" rx="21" ry="26" {...STROKE} />
      <path
        d="M 36 58 C 33 68 28 76 20 82 M 64 58 C 67 68 72 76 80 82"
        {...STROKE}
      />
      <path d="M 42 58 L 42 68 M 58 58 L 58 68" {...STROKE} />
    </>
  );
}

function LeftProfileGuide() {
  return (
    <>
      <path
        d="M 62 34 C 54 24 40 26 34 38 C 30 48 31 58 36 66 C 41 74 50 76 56 70 C 61 64 64 52 62 34 Z"
        {...STROKE}
      />
      <path d="M 36 66 C 32 74 28 80 22 84" {...STROKE} />
      <path d="M 48 72 C 52 78 54 82 56 86" {...STROKE} />
    </>
  );
}

function RightProfileGuide() {
  return (
    <>
      <path
        d="M 38 34 C 46 24 60 26 66 38 C 70 48 69 58 64 66 C 59 74 50 76 44 70 C 39 64 36 52 38 34 Z"
        {...STROKE}
      />
      <path d="M 64 66 C 68 74 72 80 78 84" {...STROKE} />
      <path d="M 52 72 C 48 78 46 82 44 86" {...STROKE} />
    </>
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
      <CornerMarks />
      {pose === "front" ? <FrontGuide /> : null}
      {pose === "left" ? <LeftProfileGuide /> : null}
      {pose === "right" ? <RightProfileGuide /> : null}
    </svg>
  );
}
