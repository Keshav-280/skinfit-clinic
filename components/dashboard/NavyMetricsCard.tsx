"use client";

import { Lock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { scoreOutOfTen } from "@/src/lib/clarityGrade";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

/** Rings: kAI (inner) · consistency (middle) · progress (outer). */
const LIGHT_RINGS = {
  kai: SKINFIT_THEME.ink,
  consistency: SKINFIT_THEME.navyMid,
  progress: SKINFIT_THEME.blush,
} as const;

/** On the filled navy card, use lighter brand tints so arcs stay visible. */
const NAVY_RINGS = {
  kai: SKINFIT_THEME.indigoSoft,
  consistency: SKINFIT_THEME.sand,
  progress: SKINFIT_THEME.blush,
} as const;

const LIGHT_BADGES = {
  kai: { bg: SKINFIT_THEME.linen, color: SKINFIT_THEME.ink },
  consistency: { bg: SKINFIT_THEME.indigoPale, color: SKINFIT_THEME.midnight },
  progress: { bg: SKINFIT_THEME.rosePale, color: SKINFIT_THEME.roseMid },
} as const;

const UNLOCK_HINT = "Complete your 2nd week scan to unlock";

/**
 * Apple-style ring track: a dimmed version of the ring's own active color,
 * so a locked/empty ring previews the color it will fill with (not grey).
 */
function dimRingColor(hex: string, alpha = 0.25): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "rgba(255,255,255,0.14)";
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const RING_SIZE = 168;
const STROKE = 14;
const GAP = 3;

function ringGeometry() {
  const outerR = (RING_SIZE - STROKE) / 2;
  const middleR = outerR - STROKE - GAP;
  const innerR = middleR - STROKE - GAP;
  return { outerR, middleR, innerR };
}

function RingCircle({
  cx,
  cy,
  radius,
  fill,
  color,
  track,
}: {
  cx: number;
  cy: number;
  radius: number;
  fill: number;
  color: string;
  track: string;
}) {
  const v = Math.min(100, Math.max(0, fill));
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v / 100);

  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={track}
        strokeWidth={STROKE}
      />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        opacity={v === 0 ? 0 : 1}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </>
  );
}

function LockedRingOverlay({
  radius,
  active,
  tipId,
  onHoverIn,
  onHoverOut,
  onToggle,
}: {
  radius: number;
  active: boolean;
  tipId: string;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onToggle: () => void;
}) {
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const outer = radius + STROKE / 2 + 2;
  const inner = Math.max(0, radius - STROKE / 2 - 2);
  const lockY = cy - radius;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={(outer + inner) / 2}
        fill="transparent"
        stroke="transparent"
        strokeWidth={outer - inner}
        style={{ pointerEvents: "all" }}
        className="cursor-pointer"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") onHoverIn();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") onHoverOut();
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") return;
          e.stopPropagation();
          onToggle();
        }}
        tabIndex={0}
        role="button"
        aria-expanded={active}
        aria-describedby={active ? tipId : undefined}
        aria-label={UNLOCK_HINT}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      />
      <foreignObject
        x={cx - 9}
        y={lockY - 9}
        width={18}
        height={18}
        className="pointer-events-none overflow-visible"
      >
        <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1E1B31]">
          <Lock className="h-2.5 w-2.5 text-white/70" strokeWidth={2.5} aria-hidden />
        </div>
      </foreignObject>
    </g>
  );
}

function UnlockTooltip({ visible, labelId }: { visible: boolean; labelId: string }) {
  return (
    <div
      id={labelId}
      role="tooltip"
      aria-hidden={!visible}
      className={`pointer-events-none absolute left-1/2 top-1 z-20 w-max max-w-[210px] -translate-x-1/2 rounded-lg bg-[#1a2744] px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug text-white shadow-lg transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {UNLOCK_HINT}
    </div>
  );
}

type NavyMetricsCardProps = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful?: boolean;
  latestScanAt: string | null;
  consistencyScore: number;
  scoresUnlocked?: boolean;
  /** Number of scans the patient has taken - Progress unlocks from the 2nd scan. */
  scanCount?: number;
  className?: string;
  /** Light-on-white theme (rings + a label/value legend) instead of the filled navy card. */
  light?: boolean;
};

export function NavyMetricsCard({
  kaiSkinScore,
  weeklyDeltaScore,
  weeklyDeltaMeaningful = true,
  consistencyScore,
  latestScanAt,
  scanCount = 0,
  scoresUnlocked: _scoresUnlocked = false,
  light = false,
  className = "",
}: NavyMetricsCardProps) {
  const [lockedTip, setLockedTip] = useState<"consistency" | "progress" | null>(null);
  const tipId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  const hasScan = Boolean(latestScanAt?.trim());

  // Progress needs a 2nd scan for a real week-over-week delta.
  // Consistency fills from weeks on the app, scans, and questionnaires.
  const progressLocked = scanCount < 2;
  const consistencyLocked = !hasScan && consistencyScore <= 0;

  const { outerR, middleR, innerR } = ringGeometry();
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  const skinFillTarget = hasScan
    ? Math.min(100, Math.max(0, Math.round(kaiSkinScore)))
    : 0;
  const [skinFill, setSkinFill] = useState(0);

  useEffect(() => {
    setSkinFill(0);
    const id = requestAnimationFrame(() => setSkinFill(skinFillTarget));
    return () => cancelAnimationFrame(id);
  }, [skinFillTarget]);

  // Consistency ring = scans + questionnaires over weeks on the app.
  // Progress ring = this week's improvement (locked until a 2nd scan).
  const consistencyFillTarget = consistencyLocked
    ? 0
    : Math.min(100, Math.max(0, Math.round(consistencyScore)));
  const progressFillTarget =
    progressLocked || !weeklyDeltaMeaningful
      ? 0
      : Math.min(100, Math.max(0, Math.round(weeklyDeltaScore)));
  const [consistencyFill, setConsistencyFill] = useState(0);
  const [progressFill, setProgressFill] = useState(0);

  useEffect(() => {
    setConsistencyFill(0);
    setProgressFill(0);
    const id = requestAnimationFrame(() => {
      setConsistencyFill(consistencyFillTarget);
      setProgressFill(progressFillTarget);
    });
    return () => cancelAnimationFrame(id);
  }, [consistencyFillTarget, progressFillTarget]);

  useEffect(() => {
    if (!lockedTip) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) {
        setLockedTip(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [lockedTip]);

  const centerTextCls = light ? "text-[#1E1B31]" : "text-white";
  const centerContent = (() => {
    if (!hasScan) {
      return (
        <p
          className={`px-1 text-center text-[10px] font-semibold leading-snug ${light ? "text-[#6B7280]" : "text-white/70"}`}
        >
          No scan yet - take your first AI scan
        </p>
      );
    }
    return (
      <span className={`text-2xl font-extrabold leading-none tabular-nums ${centerTextCls}`}>
        {scoreOutOfTen(kaiSkinScore)}
        <span className="text-sm font-bold opacity-60">/10</span>
      </span>
    );
  })();

  const legendRow = (
    color: string,
    label: string,
    value: string,
    locked: boolean,
    badgeBg: string,
    badgeColor: string
  ) => (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="text-sm font-semibold text-[#1E1B31]">{label}</span>
        {locked ? (
          <Lock className="h-3 w-3 text-[#9CA3AF]" strokeWidth={2.5} aria-hidden />
        ) : null}
      </span>
      <span
        className="min-w-[54px] rounded-full px-3 py-1 text-center text-sm font-extrabold"
        style={{ backgroundColor: badgeBg, color: badgeColor }}
      >
        {value}
      </span>
    </div>
  );

  const rings = light ? LIGHT_RINGS : NAVY_RINGS;
  const kaiLegendValue = !hasScan
    ? "-"
    : `${scoreOutOfTen(kaiSkinScore)}/10`;

  const legend = light ? (
    <div className="flex w-full flex-col gap-2.5 sm:gap-3">
      {legendRow(
        rings.kai,
        "kAI Score",
        kaiLegendValue,
        false,
        LIGHT_BADGES.kai.bg,
        LIGHT_BADGES.kai.color
      )}
      {legendRow(
        rings.consistency,
        "Consistency",
        `${Math.round(consistencyScore)}%`,
        consistencyLocked,
        LIGHT_BADGES.consistency.bg,
        LIGHT_BADGES.consistency.color
      )}
      {legendRow(
        rings.progress,
        "Progress",
        `${Math.round(Math.abs(weeklyDeltaScore))}%`,
        progressLocked || !weeklyDeltaMeaningful,
        LIGHT_BADGES.progress.bg,
        LIGHT_BADGES.progress.color
      )}
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 md:flex-col md:items-start md:justify-center md:gap-y-3">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: hasScan ? rings.kai : "rgba(255,255,255,0.35)",
          }}
          aria-hidden
        />
        <span className="text-sm font-semibold text-white/90">kAI Score</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: rings.consistency }}
          aria-hidden
        />
        <span className="flex items-center gap-0.5 text-sm font-semibold text-white/55">
          Consistency{" "}
          <Lock className="h-3 w-3 text-white/50" strokeWidth={2.5} />
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: rings.progress }}
          aria-hidden
        />
        <span className="flex items-center gap-0.5 text-sm font-semibold text-white/55">
          Progress{" "}
          <Lock className="h-3 w-3 text-white/50" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );

  return (
    <div
      ref={cardRef}
      className={
        light
          ? `flex h-full flex-row items-center justify-center gap-5 ${className}`
          : `flex h-full flex-col items-center justify-center rounded-[20px] bg-[#1E1B31] px-5 py-4 md:flex-row md:items-center md:justify-center md:gap-8 md:px-6 md:py-5 ${className}`
      }
    >
      <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <UnlockTooltip visible={lockedTip !== null} labelId={tipId} />

        <svg width={RING_SIZE} height={RING_SIZE} className="block" aria-hidden>
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            <RingCircle
              cx={cx}
              cy={cy}
              radius={outerR}
              fill={progressFill}
              color={rings.progress}
              track={dimRingColor(rings.progress, light ? 0.28 : 0.25)}
            />
            <RingCircle
              cx={cx}
              cy={cy}
              radius={middleR}
              fill={consistencyFill}
              color={rings.consistency}
              track={dimRingColor(rings.consistency, light ? 0.22 : 0.25)}
            />
            <RingCircle
              cx={cx}
              cy={cy}
              radius={innerR}
              fill={skinFill}
              color={rings.kai}
              track={dimRingColor(rings.kai, light ? 0.16 : 0.25)}
            />
          </g>

          {progressLocked && (
            <LockedRingOverlay
              radius={outerR}
              active={lockedTip === "progress"}
              tipId={tipId}
              onHoverIn={() => setLockedTip("progress")}
              onHoverOut={() => setLockedTip(null)}
              onToggle={() =>
                setLockedTip((t) => (t === "progress" ? null : "progress"))
              }
            />
          )}
          {consistencyLocked && (
            <LockedRingOverlay
              radius={middleR}
              active={lockedTip === "consistency"}
              tipId={tipId}
              onHoverIn={() => setLockedTip("consistency")}
              onHoverOut={() => setLockedTip(null)}
              onToggle={() =>
                setLockedTip((t) =>
                  t === "consistency" ? null : "consistency"
                )
              }
            />
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-[56px] w-[56px] items-center justify-center">
            {centerContent}
          </div>
        </div>
      </div>

      <div className={light ? "min-w-0 flex-1" : "mt-4 md:mt-0"}>{legend}</div>
    </div>
  );
}
