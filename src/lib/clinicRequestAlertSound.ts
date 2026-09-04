let sharedCtx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  gain = 0.18
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Unlock autoplay after a staff click so later request chimes can play. */
export async function unlockClinicRequestAlertSound(): Promise<boolean> {
  const ctx = audioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/** Two-note clinic ding. Safe to call after `unlockClinicRequestAlertSound`. */
export async function playClinicRequestAlertSound(): Promise<void> {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    tone(ctx, 784, t, 0.16, 0.2);
    tone(ctx, 1046.5, t + 0.14, 0.22, 0.22);
  } catch {
    /* autoplay still blocked */
  }
}
