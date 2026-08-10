"use client";

import { Lock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { ClinicScoreUnlockModal } from "@/components/dashboard/ClinicScoreUnlockModal";
import { CLINIC_SCORE_UNLOCK, patientKaiScoreView } from "@/src/lib/clarityGrade";

// Three distinct Apple-style ring colors.
const KAI_COLOR = "#22D3EE"; // inner — cyan
const CONSISTENCY_COLOR = "#30D158"; // middle — green
const PROGRESS_COLOR = "#FA114F"; // outer — red
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

const RING_SIZE = 220;
const STROKE = 18;
const GAP = 4;

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
        <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#2D3E6B]">
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
  /** Number of scans the patient has taken — rings unlock from the 2nd scan. */
  scanCount?: number;
  className?: string;
};

export function NavyMetricsCard({
  kaiSkinScore,
  weeklyDeltaScore,
  weeklyDeltaMeaningful = true,
  consistencyScore,
  latestScanAt,
  scoresUnlocked = false,
  scanCount = 0,
  className = "",
}: NavyMetricsCardProps) {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [lockedTip, setLockedTip] = useState<"consistency" | "progress" | null>(null);
  const tipId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  const hasScan = Boolean(latestScanAt?.trim());
  const kai = hasScan ? patientKaiScoreView(kaiSkinScore, scoresUnlocked) : null;
  const lockedKaiAriaLabel = `${CLINIC_SCORE_UNLOCK.title}. ${CLINIC_SCORE_UNLOCK.message}`;

  // Consistency + Progress rings unlock from the patient's 2nd scan onward.
  const ringsLocked = scanCount < 2;

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

  // Consistency ring = weekly check-in consistency; Progress ring = this week's
  // improvement. Both stay empty while locked (behind the lock overlay).
  const consistencyFillTarget = ringsLocked
    ? 0
    : Math.min(100, Math.max(0, Math.round(consistencyScore)));
  const progressFillTarget =
    ringsLocked || !weeklyDeltaMeaningful
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

  const centerContent = (() => {
    if (!hasScan) {
      return (
        <p className="px-1 text-center text-[10px] font-semibold leading-snug text-white/70">
          No scan yet — take your first AI scan
        </p>
      );
    }
    if (kai?.showLock) {
      return (
        <button
          type="button"
          onClick={() => setUnlockOpen(true)}
          aria-label={lockedKaiAriaLabel}
          className="flex flex-col items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
        >
          <span className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-white/60" strokeWidth={2.25} aria-hidden />
            <span className="text-[1.75rem] font-extrabold leading-none text-white">
              {kai.gaugeDisplayValue}
            </span>
          </span>
        </button>
      );
    }
    return (
      <span className="text-[1.75rem] font-extrabold leading-none text-white tabular-nums">
        {kai?.kaiPrimary}
      </span>
    );
  })();

  const legend = (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 md:flex-col md:items-start md:justify-center md:gap-y-3">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: hasScan ? KAI_COLOR : "rgba(255,255,255,0.35)",
          }}
          aria-hidden
        />
        <span className="text-sm font-semibold text-white/90">kAI Score</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: CONSISTENCY_COLOR }}
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
          style={{ backgroundColor: PROGRESS_COLOR }}
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
      className={`flex h-full flex-col items-center justify-center rounded-[20px] bg-[#2D3E6B] px-5 py-4 md:flex-row md:items-center md:justify-center md:gap-8 md:px-6 md:py-5 ${className}`}
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
              color={PROGRESS_COLOR}
              track={dimRingColor(PROGRESS_COLOR)}
            />
            <RingCircle
              cx={cx}
              cy={cy}
              radius={middleR}
              fill={consistencyFill}
              color={CONSISTENCY_COLOR}
              track={dimRingColor(CONSISTENCY_COLOR)}
            />
            <RingCircle
              cx={cx}
              cy={cy}
              radius={innerR}
              fill={skinFill}
              color={KAI_COLOR}
              track={dimRingColor(KAI_COLOR)}
            />
          </g>

          {ringsLocked && (
            <>
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
            </>
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`flex h-[72px] w-[72px] items-center justify-center ${
              hasScan && kai?.showLock ? "pointer-events-auto" : ""
            }`}
          >
            {centerContent}
          </div>
        </div>
      </div>

      <div className="mt-4 md:mt-0">{legend}</div>

      <ClinicScoreUnlockModal open={unlockOpen} onClose={() => setUnlockOpen(false)} />
    </div>
  );
}
