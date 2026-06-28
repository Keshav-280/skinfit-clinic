"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  Bug,
  Camera,
  ChevronLeft,
  Info,
  CheckCircle2,
  Move,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CaptureGuidanceSnapshot } from "@/src/lib/scanCaptureGuidance";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const MUTED = "#6B7280";
const ACCENT = "#E07088";
const ACCENT_SOFT = "rgba(224, 112, 136, 0.22)";
const CAPTURE_BG = "#F6F5F2";

type StepMeta = {
  title: string;
  subtitle: string;
  tips: readonly string[];
};

type Props = {
  step: StepMeta;
  stepIndex: number;
  totalSteps: number;
  viewfinder: ReactNode;
  reviewingCapture: boolean;
  guidance: CaptureGuidanceSnapshot | null;
  guidanceReady?: boolean;
  voiceEnabled: boolean;
  showDebug: boolean;
  captureDebugUi: boolean;
  onToggleVoice: () => void;
  onToggleDebug: () => void;
  onBack: () => void;
  controls: ReactNode;
  sidebar: ReactNode;
};

/**
 * Two independent guidance rows — light and distance/framing — so fixing one
 * never hides or "interrupts" the other. Each shows its own pass/warn state.
 */
function GuidanceStatusBoxes({
  guidance,
}: {
  guidance: CaptureGuidanceSnapshot | null;
}) {
  if (!guidance) {
    return (
      <div className="flex w-full max-w-[280px] flex-col items-center gap-2 rounded-2xl border border-[rgba(224,112,136,0.35)] bg-white px-4 py-4 shadow-sm sm:max-w-xs">
        <Info className="h-6 w-6 shrink-0" style={{ color: ACCENT }} aria-hidden />
        <p className="text-sm font-bold leading-snug sm:text-base" style={{ color: NAVY }}>
          Checking lighting and distance…
        </p>
      </div>
    );
  }

  const lightingOk = guidance.lighting === "good" || guidance.lightingScore >= 60;
  const faceOk = guidance.face === "good";

  return (
    <div className="flex w-full max-w-[280px] flex-col gap-2 sm:max-w-xs">
      <GuidanceRow
        ok={lightingOk}
        icon={<Sun className="h-4 w-4 shrink-0" style={{ color: NAVY }} aria-hidden />}
        label="Light"
        message={lightingOk ? "Lighting looks good" : guidance.lightingMessage}
      />
      <GuidanceRow
        ok={faceOk}
        icon={<Move className="h-4 w-4 shrink-0" style={{ color: NAVY }} aria-hidden />}
        label="Distance"
        message={faceOk ? "Nicely framed" : guidance.faceMessage}
      />
      {guidance.expressionMessage ? (
        <GuidanceRow
          ok={guidance.expressionOk === true}
          icon={<Info className="h-4 w-4 shrink-0" style={{ color: NAVY }} aria-hidden />}
          label="Pose"
          message={guidance.expressionMessage}
        />
      ) : null}
      {guidance.readyToCapture ? (
        <p className="text-center text-xs font-semibold text-emerald-700">
          Ready — tap Capture when you're set.
        </p>
      ) : null}
    </div>
  );
}

function GuidanceRow({
  ok,
  icon,
  label,
  message,
}: {
  ok: boolean;
  icon: ReactNode;
  label: string;
  message: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border px-3.5 py-3 shadow-sm ${
        ok
          ? "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)]"
          : "border-[rgba(224,112,136,0.4)] bg-white"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
      )}
      <div className="min-w-0 text-left">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.14em]"
          style={{ color: ok ? "#059669" : ACCENT }}
        >
          {label}
        </p>
        <p className="text-sm font-semibold leading-snug" style={{ color: NAVY }}>
          {message}
        </p>
      </div>
    </div>
  );
}

function StepTipsList({ tips }: { tips: readonly string[] }) {
  return (
    <ul className="space-y-2.5">
      {tips.map((tip) => (
        <li
          key={tip}
          className="flex items-center justify-center gap-2 text-sm font-medium leading-snug sm:text-base"
          style={{ color: MUTED }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: ACCENT }}
            aria-hidden
          />
          {tip}
        </li>
      ))}
    </ul>
  );
}

export function WebCaptureStepShell({
  step,
  stepIndex,
  totalSteps,
  viewfinder,
  reviewingCapture,
  guidance,
  voiceEnabled,
  showDebug,
  captureDebugUi,
  onToggleVoice,
  onToggleDebug,
  onBack,
  controls,
  sidebar,
}: Props) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/80 shadow-[0_16px_48px_-20px_rgba(44,62,107,0.35)] ring-1 ring-[#2C3E6B]/10 sm:rounded-3xl"
      style={{ backgroundColor: CAPTURE_BG }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 sm:px-3 sm:py-2">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#2C3E6B] transition hover:bg-white/70"
            aria-label="Back to scan options"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div
            className="h-1 min-w-0 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: ACCENT_SOFT }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: ACCENT }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: MUTED }}>
            {stepIndex + 1}/{totalSteps}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleVoice}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                voiceEnabled
                  ? "border-[#2C3E6B]/15 bg-[#2C3E6B] text-white"
                  : "border-[#2C3E6B]/10 bg-white text-[#2C3E6B]"
              }`}
              aria-pressed={voiceEnabled}
              aria-label={voiceEnabled ? "Mute voice guide" : "Enable voice guide"}
            >
              {voiceEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </button>
            {captureDebugUi ? (
              <button
                type="button"
                onClick={onToggleDebug}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                  showDebug
                    ? "border-emerald-600/20 bg-emerald-600 text-white"
                    : "border-[#2C3E6B]/10 bg-white text-[#2C3E6B]"
                }`}
                aria-pressed={showDebug}
                aria-label={showDebug ? "Hide capture debug" : "Show capture debug"}
              >
                <Bug className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Side columns flex; center column auto-width so the feed never overlaps tips */}
        <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden sm:gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-6 lg:gap-x-8">
          <div className="relative z-10 flex min-h-0 min-w-0 flex-col items-center justify-center gap-5 overflow-y-auto overscroll-contain px-1 text-center md:pr-2">
            {!reviewingCapture ? (
              <GuidanceStatusBoxes guidance={guidance} />
            ) : (
              <div className="flex w-full max-w-[280px] flex-col items-center gap-2.5 rounded-2xl border border-[rgba(224,112,136,0.35)] bg-white px-4 py-4 shadow-sm sm:max-w-xs sm:px-5 sm:py-5">
                <Info className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" style={{ color: ACCENT }} aria-hidden />
                <p className="text-sm font-bold leading-snug sm:text-base" style={{ color: NAVY }}>
                  Review this photo. Use it or retake.
                </p>
              </div>
            )}

            <div className="w-full max-w-[280px] sm:max-w-xs">
              <p
                className="text-sm font-extrabold uppercase tracking-[0.14em] sm:text-base"
                style={{ color: ACCENT }}
              >
                Tips
              </p>
              <div className="mt-3">
                <StepTipsList tips={step.tips} />
              </div>
            </div>
          </div>

          <div className="relative z-0 flex min-h-0 min-w-0 flex-col items-center gap-1 sm:gap-1.5">
            <div className="shrink-0 text-center">
              <h2 className="text-sm font-extrabold leading-tight sm:text-base lg:text-lg" style={{ color: NAVY }}>
                {step.title}
              </h2>
              <p className="line-clamp-1 text-[10px] leading-snug sm:text-xs" style={{ color: MUTED }}>
                {step.subtitle}
              </p>
            </div>

            <div className="relative h-[320px] w-[240px] shrink-0 overflow-hidden rounded-xl bg-zinc-900 shadow-inner sm:rounded-2xl md:h-[384px] md:w-[288px] lg:h-[440px] lg:w-[330px] xl:h-[520px] xl:w-[390px]">
              {viewfinder}
            </div>

            <div className="w-full shrink-0">{controls}</div>
          </div>

          <aside className="relative z-10 flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto overscroll-contain pl-0.5 md:pl-2">
            {sidebar}
          </aside>
        </div>
      </div>
    </div>
  );
}

export function WebCaptureShutterControls({
  reviewingCapture,
  shooting,
  shutterDisabled,
  onShutter,
  onRetake,
  onConfirm,
  isLastStep,
}: {
  reviewingCapture: boolean;
  shooting?: boolean;
  shutterDisabled?: boolean;
  onShutter: () => void;
  onRetake: () => void;
  onConfirm: () => void;
  isLastStep: boolean;
}) {
  if (reviewingCapture) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onConfirm}
          className="flex w-full items-center justify-center rounded-lg py-2 text-xs font-bold text-white transition hover:opacity-95 sm:rounded-xl sm:py-2.5 sm:text-sm"
          style={{ backgroundColor: ACCENT }}
        >
          {isLastStep ? "Use photo & finish" : "Use photo & next"}
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="flex w-full items-center justify-center rounded-lg border py-2 text-xs font-bold transition hover:bg-white/80 sm:rounded-xl sm:py-2.5 sm:text-sm"
          style={{ borderColor: ACCENT, color: ACCENT }}
        >
          Retake
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onShutter}
      disabled={shutterDisabled || shooting}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-extrabold text-white shadow-md transition enabled:hover:opacity-95 disabled:opacity-45 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
      style={{ backgroundColor: ACCENT }}
      aria-label="Capture photo"
    >
      <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
      Capture
    </button>
  );
}
