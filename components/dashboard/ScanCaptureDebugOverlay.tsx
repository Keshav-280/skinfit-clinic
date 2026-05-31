"use client";

import {
  CAPTURE_FRAMING_THRESHOLDS,
  captureAutoZoomTargetFill,
  IDEAL_FACE_FILL_MAX,
  IDEAL_FACE_FILL_MIN,
  type CaptureAssistModels,
  type CaptureGuidanceSnapshot,
} from "@/src/lib/scanCaptureGuidance";

type Props = {
  guidance: CaptureGuidanceSnapshot | null;
  captureZoom: number;
  models?: CaptureAssistModels;
  faceTracked?: boolean;
  /** Optional extra lines (e.g. countdown, stable ticks). */
  extra?: Record<string, string | number | boolean | null | undefined>;
  /** Explicit toggle — overrides env default when provided. */
  visible?: boolean;
  /** overlay = on preview; panel = sidebar debugger card */
  variant?: "overlay" | "panel";
};

function buildCaptureDebugRows(
  guidance: CaptureGuidanceSnapshot | null,
  captureZoom: number,
  models: CaptureAssistModels | undefined,
  faceTracked: boolean | undefined,
  extra: Props["extra"]
): Array<[string, string]> {
  const t = CAPTURE_FRAMING_THRESHOLDS;
  const targetFill = captureAutoZoomTargetFill();
  const area = guidance?.faceFill ?? null;
  const areaOk =
    area != null &&
    area >= IDEAL_FACE_FILL_MIN &&
    area <= IDEAL_FACE_FILL_MAX;

  const rows: Array<[string, string]> = [
    ["area", `${fmtPct(area)}  (${fmtNum(area, 3)})`],
    [
      "ideal area",
      `${fmtPct(IDEAL_FACE_FILL_MIN)}–${fmtPct(IDEAL_FACE_FILL_MAX)}`,
    ],
    ["too small", `< ${fmtPct(t.tooSmallEnter)}  ·  ok ≥ ${fmtPct(t.tooSmallExit)}`],
    ["too large", `> ${fmtPct(t.tooLargeEnter)}  ·  ok ≤ ${fmtPct(t.tooLargeExit)}`],
    ["zoom target fill", fmtPct(targetFill)],
    ["face", guidance?.face ?? "—"],
    ["light", guidance ? `${guidance.lighting} (${guidance.lightingScore})` : "—"],
    ["zoom", `${fmtNum(captureZoom, 1)}×`],
    [
      "sugg zoom",
      guidance?.suggestedZoom != null ? `${fmtNum(guidance.suggestedZoom, 1)}×` : "—",
    ],
    ["ready", guidance?.readyToCapture ? "yes" : "no"],
    ["area in band", areaOk ? "yes" : "no"],
    ["mediapipe", models?.mediapipe ?? "—"],
    ["face tracked", faceTracked ? "yes" : "no"],
  ];

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      rows.push([k, v == null ? "—" : String(v)]);
    }
  }

  return rows;
}

function fmtPct(fill: number | null | undefined): string {
  if (fill == null || !Number.isFinite(fill)) return "—";
  return `${(fill * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Opt-in only — set NEXT_PUBLIC_CAPTURE_DEBUG=1 to show capture debug UI. */
export function isCaptureDebugEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_CAPTURE_DEBUG?.trim();
  return flag === "1" || flag === "true";
}

export function ScanCaptureDebugOverlay({
  guidance,
  captureZoom,
  models,
  faceTracked,
  extra,
  visible,
  variant = "overlay",
}: Props) {
  const show = visible ?? isCaptureDebugEnabled();
  if (!show) return null;

  const rows = buildCaptureDebugRows(
    guidance,
    captureZoom,
    models,
    faceTracked,
    extra
  );

  const isPanel = variant === "panel";

  return (
    <div
      className={
        isPanel
          ? "max-h-52 overflow-y-auto rounded-xl border border-emerald-500/35 bg-zinc-900 px-3 py-2 font-mono text-[10px] leading-relaxed text-emerald-100 shadow-inner"
          : "pointer-events-none absolute left-2 top-2 z-[100] max-h-[min(55%,320px)] max-w-[min(100%,15rem)] overflow-y-auto rounded-md border border-emerald-500/40 bg-black/85 px-2 py-1.5 font-mono text-[9px] leading-relaxed text-emerald-100 shadow-lg"
      }
      aria-hidden={!isPanel}
      aria-label={isPanel ? "Capture debug metrics" : undefined}
    >
      <p
        className={
          isPanel
            ? "mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400"
            : "mb-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-400/90"
        }
      >
        Capture debug
      </p>
      {rows.map(([label, value]) => (
        <p key={label} className="whitespace-pre-wrap break-all">
          <span className="text-zinc-400">{label}: </span>
          <span className={label === "area" ? "font-bold text-white" : ""}>
            {value}
          </span>
        </p>
      ))}
    </div>
  );
}
