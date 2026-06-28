import type { VoicePriority } from "./captureVoiceGuide";
import { CAPTURE_READY_VOICE_HINT } from "./captureVoiceGuide";
import type { CaptureGuidanceSnapshot } from "./scanCaptureGuidance";

export type CaptureVoiceHint = {
  text: string;
  priority: VoicePriority;
  /** Stable key so we do not re-speak when only numeric scores jitter. */
  key: string;
};

/** One spoken line at a time — never light + distance separately. */
export function resolveCaptureVoiceHint(
  guidance: CaptureGuidanceSnapshot | null | undefined
): CaptureVoiceHint | null {
  if (!guidance) return null;

  const lightingOk =
    guidance.lighting === "good" || guidance.lightingScore >= 60;
  const faceOk = guidance.face === "good";
  const faceBad = !faceOk;
  const lightBad = !lightingOk;

  if (guidance.face === "no_face") {
    return {
      text: guidance.faceMessage,
      priority: "critical",
      key: "critical:no_face",
    };
  }

  if (faceBad && lightBad) {
    return {
      text: "Adjust your distance and lighting.",
      priority: "framing",
      key: "both:distance_light",
    };
  }

  if (faceBad) {
    return {
      text: guidance.faceMessage,
      priority: "framing",
      key: `framing:${guidance.face}`,
    };
  }

  if (guidance.expressionMessage && guidance.expressionOk === false) {
    return {
      text: guidance.expressionMessage,
      priority: "expression",
      key: "expression",
    };
  }

  if (lightBad) {
    return {
      text: guidance.lightingMessage,
      priority: "lighting",
      key: `lighting:${guidance.lighting}`,
    };
  }

  if (guidance.readyToCapture) {
    return {
      text: CAPTURE_READY_VOICE_HINT,
      priority: "ready",
      key: "ready",
    };
  }

  return null;
}

export const CAPTURE_VOICE_VOLUME_DEFAULT = 0.42;
export const CAPTURE_VOICE_VOLUME_MIN = 0.12;
export const CAPTURE_VOICE_VOLUME_MAX = 1;

export function clampCaptureVoiceVolume(value: number): number {
  if (!Number.isFinite(value)) return CAPTURE_VOICE_VOLUME_DEFAULT;
  return Math.max(
    CAPTURE_VOICE_VOLUME_MIN,
    Math.min(CAPTURE_VOICE_VOLUME_MAX, value)
  );
}

const VOICE_VOLUME_STORAGE_KEY = "skinfit.captureVoiceVolume";

export function loadStoredCaptureVoiceVolume(): number {
  if (typeof window === "undefined") return CAPTURE_VOICE_VOLUME_DEFAULT;
  try {
    const raw = sessionStorage.getItem(VOICE_VOLUME_STORAGE_KEY);
    if (raw == null) return CAPTURE_VOICE_VOLUME_DEFAULT;
    return clampCaptureVoiceVolume(Number.parseFloat(raw));
  } catch {
    return CAPTURE_VOICE_VOLUME_DEFAULT;
  }
}

export function storeCaptureVoiceVolume(value: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      VOICE_VOLUME_STORAGE_KEY,
      String(clampCaptureVoiceVolume(value))
    );
  } catch {
    /* ignore quota / private mode */
  }
}
