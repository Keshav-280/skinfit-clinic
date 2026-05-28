"use client";

import { isMediapipeEnabled } from "@/src/lib/faceCaptureConfig";
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
    <li className={`flex min-w-0 flex-col gap-0.5 ${text}`}>
      <span className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="truncate font-semibold">{label}</span>
      </span>
      <span className="pl-2.5 font-normal leading-tight text-[#6B7280]">{detail}</span>
    </li>
  );
}

export function ScanCaptureModelStatus({
  models,
  compact,
  needsExpressionModel,
}: Props) {
  const textSize = compact ? "text-[10px] leading-snug" : "text-[11px] leading-snug";
  const mpEnabled = isMediapipeEnabled();

  const faceLine = line(
    "FaceDetector",
    models.faceDetector === "ready" ? "ok" : "warn",
    models.faceDetector === "ready"
      ? "loaded (experimental browser API)"
      : mpEnabled
        ? "not in Chrome stable — use MediaPipe below for face position"
        : "optional — basic skin-tone framing when unavailable"
  );

  let blazeState: "ok" | "warn" | "muted" | "loading" = "muted";
  let blazeDetail = "not started";
  switch (models.blazeFace) {
    case "loading":
      blazeState = "loading";
      blazeDetail = "loading…";
      break;
    case "ready":
      blazeState = "ok";
      blazeDetail = "framing bbox (primary)";
      break;
    case "failed":
      blazeState = "warn";
      blazeDetail = "failed — using landmark fallback";
      break;
    default:
      blazeDetail = models.blazeFace === "off" ? "off" : "waiting for camera";
      break;
  }
  const blazeLine =
    models.blazeFace !== "off"
      ? line("BlazeFace", blazeState, blazeDetail)
      : null;

  let mpState: "ok" | "warn" | "muted" | "loading" = "muted";
  let mpDetail = "not started";
  switch (models.mediapipe) {
    case "loading":
      mpState = "loading";
      mpDetail = "loading…";
      break;
    case "ready":
      mpState = "ok";
      mpDetail = "eyes-closed / expression";
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

  const mpLine =
    mpEnabled && models.mediapipe !== "off"
      ? line("MediaPipe", mpState, mpDetail)
      : null;

  let rfState: "ok" | "warn" | "muted" | "loading" = "muted";
  let rfDetail = "off";
  if (models.retinaface !== "off") {
    switch (models.retinaface) {
      case "loading":
        rfState = "loading";
        rfDetail = "server inference…";
        break;
      case "ready":
        rfState = "ok";
        rfDetail = "RetinaFace (server)";
        break;
      case "failed":
        rfState = "warn";
        rfDetail = models.retinafaceError ?? "weights missing or API error";
        break;
      default:
        rfDetail = "waiting";
    }
  }
  const rfLine =
    models.retinaface !== "off"
      ? line("RetinaFace", rfState, rfDetail)
      : null;

  let clfDetail = "off";
  let clfState: "ok" | "warn" | "muted" = "muted";
  if (models.expressionClassifier !== "off") {
    if (models.expressionClassifier === "ready") {
      clfState = "ok";
      clfDetail = "blink classifier (server)";
    } else if (models.expressionClassifier === "failed") {
      clfState = "warn";
      clfDetail = "classifier unavailable — blendshapes fallback";
    } else {
      clfDetail = "waiting";
    }
  }
  const clfLine =
    models.expressionClassifier !== "off"
      ? line("Expression AI", clfState, clfDetail)
      : null;

  return (
    <div
      className={`rounded-lg border border-[rgba(44,62,107,0.1)] bg-white/45 px-2 py-1.5 ${compact ? "" : "px-2.5 py-2"}`}
      aria-label="Capture assistant models"
    >
      <p className={`mb-1 font-semibold uppercase tracking-wide text-[#6B7280] ${textSize}`}>
        Capture AI
      </p>
      <ul className={`grid grid-cols-3 gap-x-2 gap-y-1.5 ${textSize}`}>
        {blazeLine}
        {mpLine}
        {rfLine}
        {clfLine}
      </ul>
      {mpEnabled && needsExpressionModel && models.mediapipe === "failed" && (
        <p className={`mt-1.5 font-medium text-amber-900 ${textSize}`}>
          Run <span className="font-mono">npm run mediapipe:sync-wasm</span> once, refresh, and
          allow camera + network to Google storage.
        </p>
      )}
    </div>
  );
}
