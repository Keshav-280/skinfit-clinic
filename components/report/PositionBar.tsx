"use client";

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
  const now = clampPct(currentPosition);
  const prev =
    previousPosition != null ? clampPct(previousPosition) : undefined;
  const light = variant === "light";

  return (
    <div className={`pbar ${className}`}>
      <div
        className={`mb-[9px] flex justify-between text-[10px] font-semibold tracking-[0.14em] ${
          light ? "text-kai-ink-3" : "text-white/40"
        }`}
      >
        <span>D</span>
        <span>C</span>
        <span>B</span>
        <span>A</span>
      </div>
      <div
        className={`relative h-[3px] rounded-sm ${
          light ? "bg-kai-track" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-[-3px] h-[9px] w-px ${
            light ? "bg-kai-track" : "bg-white/15"
          }`}
          style={{ left: "33.3%" }}
        />
        <span
          className={`absolute top-[-3px] h-[9px] w-px ${
            light ? "bg-kai-track" : "bg-white/15"
          }`}
          style={{ left: "66.6%" }}
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
          className={`absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
            light
              ? "bg-kai-navy shadow-[0_0_0_3px_#EEF3EC]"
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
