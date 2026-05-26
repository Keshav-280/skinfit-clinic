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
};

function fmtPct(fill: number | null | undefined): string {
  if (fill == null || !Number.isFinite(fill)) return "—";
  return `${(fill * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Dev default on; set NEXT_PUBLIC_CAPTURE_DEBUG=0 to hide, =1 to force on in production. */
export function isCaptureDebugEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_CAPTURE_DEBUG?.trim();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return process.env.NODE_ENV === "development";
}

export function ScanCaptureDebugOverlay({
  guidance,
  captureZoom,
  models,
  faceTracked,
  extra,
}: Props) {
  if (!isCaptureDebugEnabled()) return null;

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

  return (
    <div
      className="pointer-events-none absolute left-2 top-2 z-[100] max-w-[min(100%,14rem)] rounded-md bg-black/75 px-2 py-1.5 font-mono text-[9px] leading-relaxed text-emerald-100 shadow-md"
      aria-hidden
    >
      <p className="mb-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-400/90">
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
