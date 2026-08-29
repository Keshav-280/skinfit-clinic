"use client";

import { useEffect, useState } from "react";
import { gradeRingColor } from "./reportCopy";

type ReportGradeRingProps = {
  grade: string;
  /** 0–100, A-side is 100. */
  position: number;
  size?: number;
  variant?: "light" | "glass";
};

export function ReportGradeRing({
  grade,
  position,
  size = 118,
  variant = "light",
}: ReportGradeRingProps) {
  const [fill, setFill] = useState(0);
  const color = gradeRingColor(grade);
  const glass = variant === "glass";
  const stroke = glass ? 8 : 9;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, position));

  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const offset = c * (1 - fill / 100);
  const digits = grade.replace(/[^\d]/g, "").length;
  const letterPx = Math.round(size * (digits > 1 ? 0.34 : 0.42));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`absolute inset-[10%] rounded-full ${glass ? "report-glow bg-white/15 backdrop-blur-md" : ""}`}
        style={
          glass
            ? { boxShadow: `0 0 32px -2px ${color}99` }
            : { boxShadow: `0 0 28px -4px ${color}66` }
        }
        aria-hidden
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={glass ? "rgba(255,255,255,0.28)" : "rgba(30, 27, 49,0.12)"}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-0.5">
        <span
          className={`font-light leading-none tracking-[-0.06em] ${
            glass ? "text-white" : "text-[#1A2035]"
          }`}
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: letterPx,
          }}
        >
          {grade}
        </span>
        <span
          className={`mt-0.5 text-[9px] font-semibold tracking-[0.12em] ${
            glass ? "text-white/70" : "text-[#8B93A4]"
          }`}
        >
          /10
        </span>
      </div>
    </div>
  );
}

type MiniGradeRingProps = {
  grade: string;
  fill: number;
  size?: number;
};

export function MiniGradeRing({ grade, fill, size = 42 }: MiniGradeRingProps) {
  const color = gradeRingColor(grade);
  const stroke = 4;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, fill));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const offset = c * (1 - shown / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(30, 27, 49,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="leading-none tracking-[-0.04em] text-[#1A2035]"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: grade.length > 1 ? 11 : 13,
          }}
        >
          {grade}
        </span>
      </div>
    </div>
  );
}
