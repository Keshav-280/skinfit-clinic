import { requireOptionalNativeModule } from "expo-modules-core";

import { configurePlaybackAudioMode } from "@/lib/audioSession";

export type VoicePriority =
  | "critical"
  | "framing"
  | "expression"
  | "ready"
  | "lighting"
  | "info";

const PRIORITY_RANK: Record<VoicePriority, number> = {
  critical: 0,
  framing: 1,
  expression: 2,
  ready: 3,
  lighting: 4,
  info: 5,
};

/** Spoken when framing, lighting, and expression checks pass. */
export const CAPTURE_READY_VOICE_HINT = "You can take the picture now.";

const COOLDOWN_MS = 4500;
const MIN_GAP_MS = 1100;

type Entry = { text: string; spokenAt: number };

type SpeechModule = typeof import("expo-speech");

/** Avoid importing `expo-speech` at load time — it throws if ExpoSpeech native code is missing. */
const speechNativeAvailable =
  requireOptionalNativeModule("ExpoSpeech") != null;

let speechModule: SpeechModule | null = null;
let speechLoadFailed = false;
let speechLoadPromise: Promise<SpeechModule | null> | null = null;

async function loadSpeechModule(): Promise<SpeechModule | null> {
  if (!speechNativeAvailable) return null;
  if (speechModule) return speechModule;
  if (speechLoadFailed) return null;
  if (!speechLoadPromise) {
    speechLoadPromise = import("expo-speech")
      .then((mod) => {
        speechModule = mod;
        return mod;
      })
      .catch(() => {
        speechLoadFailed = true;
        return null;
      });
  }
  return speechLoadPromise;
}

export function isCaptureVoiceSpeechAvailable(): boolean {
  return speechNativeAvailable;
}

/** Shown when voice is toggled on a binary built without ExpoSpeech (rebuild required). */
export const CAPTURE_VOICE_REBUILD_HINT =
  "Voice guide needs a dev build with expo-speech. From the mobile folder run: npx expo run:ios (or run:android), then open that app — not Expo Go unless your SDK includes Speech.";

export class CaptureVoiceGuide {
  private enabled = false;
  private lastByText = new Map<string, Entry>();
  private lastSpokenAt = 0;
  private currentPriority: VoicePriority | null = null;

  static isSupported(): boolean {
    return speechNativeAvailable;
  }

  setEnabled(on: boolean) {
    this.enabled = on && speechNativeAvailable;
    if (!this.enabled) {
      void this.stopSpeech();
      this.currentPriority = null;
    } else if (speechNativeAvailable) {
      void loadSpeechModule();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  reset() {
    this.lastByText.clear();
    this.lastSpokenAt = 0;
    this.currentPriority = null;
    void this.stopSpeech();
  }

  private async stopSpeech() {
    const Speech = await loadSpeechModule();
    try {
      Speech?.stop();
    } catch {
      /* ignore */
    }
  }

  speak(text: string, priority: VoicePriority = "info"): boolean {
    if (!this.enabled || !speechNativeAvailable) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    const now = Date.now();
    const prev = this.lastByText.get(trimmed);
    if (prev && now - prev.spokenAt < COOLDOWN_MS) return false;

    if (now - this.lastSpokenAt < MIN_GAP_MS) {
      const curRank = this.currentPriority
        ? PRIORITY_RANK[this.currentPriority]
        : Infinity;
      if (PRIORITY_RANK[priority] >= curRank) return false;
    }

    void configurePlaybackAudioMode()
      .then(() => loadSpeechModule())
      .then((Speech) => {
      if (!Speech || !this.enabled) return;
      try {
        Speech.stop();
        Speech.speak(trimmed, {
          rate: 1.05,
          pitch: 1,
          language: "en-US",
        });
        this.lastSpokenAt = now;
        this.lastByText.set(trimmed, { text: trimmed, spokenAt: now });
        this.currentPriority = priority;
      } catch {
        /* native module missing at runtime */
      }
    });

    return true;
  }
}

export const captureVoiceGuide = new CaptureVoiceGuide();
