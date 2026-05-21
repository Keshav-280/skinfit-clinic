"use client";

import type { CaptureAssistModels } from "@/src/lib/scanCaptureGuidance";

type Props = {
  models: CaptureAssistModels;
  compact?: boolean;
  /** When true, expression steps need MediaPipe — highlight if it failed. */
  needsExpressionModel?: boolean;
};

function line(
  label: string,
  state: "ok" | "warn" | "muted" | "loading",
  detail: string
) {
  const dot =
    state === "ok"
      ? "bg-emerald-500"
      : state === "warn"
        ? "bg-amber-500"
        : state === "loading"
          ? "bg-[#2C3E6B] animate-pulse"
          : "bg-zinc-400";
  const text =
    state === "ok"
      ? "text-[#2C3E6B]"
      : state === "warn"
        ? "text-amber-900"
        : state === "loading"
          ? "text-[#2C3E6B]"
          : "text-[#6B7280]";
  return (
    <li className={`flex items-start gap-1.5 ${text}`}>
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="font-normal"> — {detail}</span>
      </span>
    </li>
  );
}

export function ScanCaptureModelStatus({
  models,
  compact,
  needsExpressionModel,
}: Props) {
  const textSize = compact ? "text-[10px] leading-snug" : "text-[11px] leading-snug";

  const faceLine = line(
    "FaceDetector",
    models.faceDetector === "ready" ? "ok" : "warn",
    models.faceDetector === "ready"
      ? "loaded (experimental browser API)"
      : "not in Chrome stable — use MediaPipe below for face position"
  );

  let mpState: "ok" | "warn" | "muted" | "loading" = "muted";
  let mpDetail = "not started";
  switch (models.mediapipe) {
    case "loading":
      mpState = "loading";
      mpDetail = "loading…";
      break;
    case "ready":
      mpState = "ok";
      mpDetail = "loaded (blink / smile checks)";
      break;
    case "failed":
      mpState = "warn";
      mpDetail = models.mediapipeError
        ? `failed: ${models.mediapipeError}`
        : "failed to load — run npm run mediapipe:sync-wasm";
      break;
    default:
      mpDetail = "waiting for camera";
      break;
  }

  const mpLine = line("MediaPipe", mpState, mpDetail);

  return (
    <div
      className={`rounded-lg border border-[rgba(44,62,107,0.1)] bg-white/45 px-2 py-1.5 ${compact ? "" : "px-2.5 py-2"}`}
      aria-label="Capture assistant models"
    >
      <p className={`mb-1 font-semibold uppercase tracking-wide text-[#6B7280] ${textSize}`}>
        Capture AI
      </p>
      <ul className={`space-y-0.5 ${textSize}`}>
        {faceLine}
        {mpLine}
      </ul>
      {models.mediapipe === "ready" && models.faceDetector === "unsupported" && (
        <p className={`mt-1 text-[#2C3E6B] ${textSize}`}>
          Face framing uses MediaPipe (FaceDetector is optional).
        </p>
      )}
      {needsExpressionModel && models.mediapipe === "failed" && (
        <p className={`mt-1 font-medium text-amber-900 ${textSize}`}>
          Run <span className="font-mono">npm run mediapipe:sync-wasm</span> once, refresh, and
          allow camera + network to Google storage.
        </p>
      )}
    </div>
  );
}
