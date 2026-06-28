/**
 * Spoken capture coaching using the Web Speech API.
 *
 * - Single-utterance queue (cancels older speech before speaking new line)
 * - Same line is never repeated within COOLDOWN_MS
 * - Different lines are throttled by MIN_GAP_MS so we don't chatter every tick
 * - Priority ordering so framing/lighting feedback wins over auxiliary tips
 */

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

export const CAPTURE_READY_VOICE_HINT = "You can take the picture now.";

const COOLDOWN_MS = 5500;
const MIN_GAP_MS = 2200;
const CATEGORY_LOCK_MS = 3200;

type Entry = { text: string; spokenAt: number; key: string };

export class CaptureVoiceGuide {
  private enabled = false;
  private lastByText = new Map<string, Entry>();
  private lastSpokenAt = 0;
  private currentPriority: VoicePriority | null = null;
  private lastHintKey: string | null = null;
  private lastHintKeyAt = 0;
  private voice: SpeechSynthesisVoice | null = null;
  private volume = 0.42;

  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance !== "undefined"
    );
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on && CaptureVoiceGuide.isSupported()) {
      window.speechSynthesis.cancel();
      this.currentPriority = null;
    } else if (on && CaptureVoiceGuide.isSupported()) {
      this.pickVoice();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  setVolume(level: number) {
    this.volume = Math.max(0, Math.min(1, level));
  }

  getVolume() {
    return this.volume;
  }

  reset() {
    this.lastByText.clear();
    this.lastSpokenAt = 0;
    this.currentPriority = null;
    this.lastHintKey = null;
    this.lastHintKeyAt = 0;
    if (CaptureVoiceGuide.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  /** Speak `text` if it passes cooldown/priority gates. */
  speak(
    text: string,
    priority: VoicePriority = "info",
    hintKey?: string
  ): boolean {
    if (!this.enabled) return false;
    if (!CaptureVoiceGuide.isSupported()) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    const now = Date.now();
    const stableKey = hintKey ?? trimmed;

    if (
      this.lastHintKey &&
      this.lastHintKey !== stableKey &&
      now - this.lastHintKeyAt < CATEGORY_LOCK_MS &&
      priority !== "critical"
    ) {
      return false;
    }

    if (
      typeof window !== "undefined" &&
      window.speechSynthesis.speaking &&
      priority !== "critical"
    ) {
      const curRank = this.currentPriority
        ? PRIORITY_RANK[this.currentPriority]
        : Infinity;
      if (PRIORITY_RANK[priority] >= curRank) return false;
    }

    const prev = this.lastByText.get(trimmed);
    if (prev && now - prev.spokenAt < COOLDOWN_MS) return false;

    if (now - this.lastSpokenAt < MIN_GAP_MS) {
      const curRank = this.currentPriority
        ? PRIORITY_RANK[this.currentPriority]
        : Infinity;
      if (PRIORITY_RANK[priority] >= curRank) return false;
    }

    const utt = new SpeechSynthesisUtterance(trimmed);
    utt.rate = 0.98;
    utt.pitch = 1;
    utt.volume = this.volume;
    if (this.voice) utt.voice = this.voice;

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
      this.lastSpokenAt = now;
      this.lastByText.set(trimmed, { text: trimmed, spokenAt: now, key: stableKey });
      this.currentPriority = priority;
      this.lastHintKey = stableKey;
      this.lastHintKeyAt = now;
      return true;
    } catch {
      return false;
    }
  }

  private pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices?.length) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voice =
            window.speechSynthesis
              .getVoices()
              .find(
                (v) =>
                  /en[-_]?(US|GB|IN)/i.test(v.lang) ||
                  v.lang.toLowerCase().startsWith("en")
              ) ?? null;
        };
        return;
      }
      this.voice =
        voices.find(
          (v) =>
            /en[-_]?(US|GB|IN)/i.test(v.lang) ||
            v.lang.toLowerCase().startsWith("en")
        ) ?? voices[0];
    } catch {
      this.voice = null;
    }
  }
}

export const captureVoiceGuide = new CaptureVoiceGuide();
