"use client";

import { useEffect, useState } from "react";

type PositionBarProps = {
  currentPosition: number;
  previousPosition?: number;
  variant?: "dark" | "light";
  className?: string;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

export function PositionBar({
  currentPosition,
  previousPosition,
  variant = "dark",
  className = "",
}: PositionBarProps) {
  const target = clampPct(currentPosition);
  const prev =
    previousPosition != null ? clampPct(previousPosition) : undefined;
  const light = variant === "light";
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setNow(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className={`pbar ${className}`}>
      <div
        className={`mb-[9px] flex justify-between text-[10px] font-semibold tracking-[0.14em] ${
          light ? "text-kai-ink-3" : "text-white/40"
        }`}
      >
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
      <div
        className={`relative h-[4px] overflow-hidden rounded-full ${
          light ? "bg-kai-track" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${
            light ? "bg-[#1E1B31]/35" : "bg-white/25"
          }`}
          style={{ width: `${now}%` }}
        />
        <span
          className={`absolute top-[-3px] h-[10px] w-px ${
            light ? "bg-kai-track" : "bg-white/15"
          }`}
          style={{ left: "50%" }}
        />
        {prev != null ? (
          <span
            className={`absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] bg-transparent ${
              light ? "border-kai-ink-3" : "border-white/40"
            }`}
            style={{ left: `${prev}%` }}
            aria-hidden
          />
        ) : null}
        <span
          className={`absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-700 ease-out ${
            light
              ? "bg-kai-navy shadow-[0_0_0_3px_rgba(251,248,244,0.9)]"
              : "bg-kai-paper shadow-[0_0_0_3px_#1E2840]"
          }`}
          style={{ left: `${now}%` }}
          aria-hidden
        />
      </div>
      {prev != null ? (
        <div
          className={`mt-3 flex gap-4 text-[10.5px] tracking-[0.06em] ${
            light ? "text-kai-ink-3" : "text-white/50"
          }`}
        >
          <span>
            <b className={light ? "font-medium text-kai-ink" : "font-medium text-white/85"}>
              ●
            </b>{" "}
            Now
          </span>
          <span>
            <b className={light ? "font-medium text-kai-ink" : "font-medium text-white/85"}>
              ○
            </b>{" "}
            Last week
          </span>
        </div>
      ) : null}
    </div>
  );
}
