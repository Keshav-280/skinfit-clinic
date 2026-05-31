"use client";

import { AlertCircle, CheckCircle2, Sun, User } from "lucide-react";
import type {
  CaptureAssistModels,
  CaptureGuidanceSnapshot,
} from "@/src/lib/scanCaptureGuidance";

type Props = {
  guidance: CaptureGuidanceSnapshot | null;
  models: CaptureAssistModels;
  needsExpressionModel?: boolean;
  autoZoomEnabled?: boolean;
  compact?: boolean;
};

function statusIcon(ok: boolean | null) {
  if (ok === true) {
    return (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
    );
  }
  if (ok === false) {
    return <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />;
  }
  return (
    <span
      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-zinc-300"
      aria-hidden
    />
  );
}

export function ScanCaptureGuidanceBanner({
  guidance,
  models,
  needsExpressionModel,
  autoZoomEnabled,
  compact,
}: Props) {
  const textSize = compact ? "text-[11px] leading-snug" : "text-sm";

  if (!guidance) {
    return (
      <p className={`text-center text-[#6B7280] ${textSize}`}>
        Checking lighting & face…
      </p>
    );
  }

  const lightingOk =
    guidance.lighting === "good" || guidance.lightingScore >= 55;
  const faceOk = guidance.face === "good";

  return (
    <div
      className={`space-y-1.5 rounded-xl border border-white/60 bg-white/55 backdrop-blur-sm ${
        compact ? "px-2 py-2" : "px-3 py-2.5"
      }`}
    >
      <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:gap-x-3 md:gap-y-1">
      <div className={`flex min-w-0 flex-1 items-start gap-1.5 ${textSize}`}>
        {statusIcon(lightingOk)}
        <Sun className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2C3E6B]/70" aria-hidden />
        <span className={lightingOk ? "text-[#2C3E6B]" : "font-medium text-amber-900"}>
          {guidance.lightingMessage}
        </span>
      </div>
      <div className={`flex min-w-0 flex-1 items-start gap-1.5 ${textSize}`}>
        {statusIcon(faceOk)}
        <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2C3E6B]/70" aria-hidden />
        <span className={faceOk ? "text-[#2C3E6B]" : "font-medium text-amber-900"}>
          {guidance.faceMessage}
        </span>
      </div>
      </div>
      {needsExpressionModel || guidance.expressionMessage ? (
        <div className={`flex items-start gap-1.5 ${textSize}`}>
          {statusIcon(guidance.expressionOk)}
          <span
            className={
              guidance.expressionOk === true ? "text-[#2C3E6B]" : "font-medium text-amber-900"
            }
          >
            {guidance.expressionMessage ??
              (models.mediapipe === "loading"
                ? "Loading expression model…"
                : "Hold still — checking expression…")}
          </span>
        </div>
      ) : null}
      {autoZoomEnabled && guidance.suggestedZoom != null && (
        <p className="text-center text-[10px] text-[#6B7280]">Auto zoom…</p>
      )}
      {guidance.readyToCapture && (
        <p className="text-center text-[10px] font-semibold text-emerald-700">
          Ready to capture
        </p>
      )}
    </div>
  );
}
