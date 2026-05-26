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

const COOLDOWN_MS = 4500;
const MIN_GAP_MS = 1100;

type Entry = { text: string; spokenAt: number };

export class CaptureVoiceGuide {
  private enabled = false;
  private lastByText = new Map<string, Entry>();
  private lastSpokenAt = 0;
  private currentPriority: VoicePriority | null = null;
  private voice: SpeechSynthesisVoice | null = null;

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

  reset() {
    this.lastByText.clear();
    this.lastSpokenAt = 0;
    this.currentPriority = null;
    if (CaptureVoiceGuide.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  /** Speak `text` if it passes cooldown/priority gates. */
  speak(text: string, priority: VoicePriority = "info"): boolean {
    if (!this.enabled) return false;
    if (!CaptureVoiceGuide.isSupported()) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    const now = Date.now();

    const prev = this.lastByText.get(trimmed);
    if (prev && now - prev.spokenAt < COOLDOWN_MS) return false;

    if (now - this.lastSpokenAt < MIN_GAP_MS) {
      // allow only strict upgrades (lower numeric rank = higher priority)
      const curRank = this.currentPriority
        ? PRIORITY_RANK[this.currentPriority]
        : Infinity;
      if (PRIORITY_RANK[priority] >= curRank) return false;
    }

    const utt = new SpeechSynthesisUtterance(trimmed);
    utt.rate = 1.05;
    utt.pitch = 1;
    utt.volume = 1;
    if (this.voice) utt.voice = this.voice;

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
      this.lastSpokenAt = now;
      this.lastByText.set(trimmed, { text: trimmed, spokenAt: now });
      this.currentPriority = priority;
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
