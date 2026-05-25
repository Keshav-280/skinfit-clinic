"use client";

import { useId } from "react";
import { OVAL_FRAME } from "@/src/lib/scanCaptureGuidance";

/**
 * Same framing idea as mobile `FaceCaptureOvalOverlay`: dimmed scrim with an
 * elliptical cutout — align hairline to chin inside the oval (3:4 preview).
 */
export function FaceCaptureOvalOverlayWeb() {
  const rawId = useId();
  const maskId = `face-oval-mask-${rawId.replace(/:/g, "")}`;

  const vbW = 3;
  const vbH = 4;
  const cx = vbW * OVAL_FRAME.cx;
  const cy = vbH * OVAL_FRAME.cy;
  const rx = vbW * OVAL_FRAME.rx;
  const ry = vbH * OVAL_FRAME.ry;

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
