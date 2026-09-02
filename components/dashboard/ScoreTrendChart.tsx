"use client";

import { useState } from "react";

export type ScoreTrendPoint = {
  label: string;
  score10: number;
};

export function ScoreTrendChart({
  points,
  emptyHint,
}: {
  points: ScoreTrendPoint[];
  emptyHint: string;
}) {
  const [active, setActive] = useState<number | null>(
    points.length > 0 ? points.length - 1 : null
  );

  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-[#FAF8F5] px-4 text-center text-sm text-[#6B7280]">
        {emptyHint}
      </div>
    );
  }

  const w = 360;
  const h = 160;
  const padL = 28;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const minY = 0;
  const maxY = 10;
  const n = Math.max(points.length, 2);

  const xy = points.map((p, i) => {
    const x =
      points.length === 1
        ? padL + innerW / 2
        : padL + (i / (n - 1)) * innerW;
    const y = padT + innerH - ((p.score10 - minY) / (maxY - minY)) * innerH;
    return { x, y, ...p };
  });

  const line = xy
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${xy[xy.length - 1]!.x.toFixed(1)} ${padT + innerH} L ${xy[0]!.x.toFixed(1)} ${padT + innerH} Z`;
  const shown = active != null ? xy[active] : xy[xy.length - 1]!;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-extrabold tabular-nums text-[#1E1B31]">
          {shown.score10}
          <span className="text-sm font-bold text-[#6B7280]">/10</span>
        </p>
        <p className="text-xs font-semibold text-[#6B7280]">{shown.label}</p>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full"
        role="img"
        aria-label="Score history"
      >
        {[0, 5, 10].map((tick) => {
          const y = padT + innerH - ((tick - minY) / (maxY - minY)) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="#E4E6F0"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#9CA3AF]"
                fontSize="9"
              >
                {tick}
              </text>
            </g>
          );
        })}
        <path d={area} fill="#F8EDEE" />
        <path
          d={line}
          fill="none"
          stroke="#1E1B31"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xy.map((p, i) => (
          <circle
            key={`${p.label}-${i}`}
            cx={p.x}
            cy={p.y}
            r={i === active ? 5.5 : 3.5}
            fill={i === active ? "#1E1B31" : "#fff"}
            stroke="#1E1B31"
            strokeWidth="1.75"
            className="cursor-pointer"
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] font-semibold text-[#9CA3AF]">
        <span>{points[0]!.label}</span>
        {points.length > 1 ? <span>{points[points.length - 1]!.label}</span> : null}
      </div>
      {points.length === 1 ? (
        <p className="mt-2 text-center text-[11px] text-[#6B7280]">
          One scan so far - the next one will draw a trend.
        </p>
      ) : null}
    </div>
  );
}
