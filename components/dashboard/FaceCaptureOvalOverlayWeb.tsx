"use client";

import { useId } from "react";

/**
 * Same framing idea as mobile `FaceCaptureOvalOverlay`: dimmed scrim with an
 * elliptical cutout + white ring so users align face in the oval (3:4 preview).
 */
export function FaceCaptureOvalOverlayWeb() {
  const rawId = useId();
  const maskId = `face-oval-mask-${rawId.replace(/:/g, "")}`;

  const vbW = 3;
  const vbH = 4;
  const cx = vbW / 2;
  // Bigger and slightly lower oval so a full face fits comfortably.
  const cy = vbH * 0.38;
  const rx = vbW * 0.4;
  const ry = vbH * 0.2;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect width={vbW} height={vbH} fill="white" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
        </mask>
      </defs>
      <rect
        width={vbW}
        height={vbH}
        fill="rgba(0,0,0,0.55)"
        mask={`url(#${maskId})`}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={0.028}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
