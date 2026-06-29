/** Shared visual tokens + dot layouts for the Meet kAI intro card (web + mobile). */

export const KAI_MEET_CARD = {
  radius: 20,
  /** Desktop min height — taller hero card. */
  minHeightWide: 460,
  minHeightPhone: 300,
  gradient: {
    /** Radial spotlight glow behind the avatar. */
    glow: "rgba(200, 215, 255, 0.55)",
    mid: "#8EA3DE",
    edge: "#465A9C",
    deep: "#203066",
  },
  text: {
    meet: "#1B2C5B",
    desc: "#1B2C5B",
    typed: "rgba(255,255,255,0.92)",
    cursor: "rgba(255,255,255,0.75)",
  },
} as const;

export type MeetCardDot = {
  x: number;
  y: number;
  r: number;
  opacity: number;
  key: number;
};

/** Subtle dots scattered across the full card (deterministic for SSR). */
export function meetCardBackgroundDots(): MeetCardDot[] {
  const dots: MeetCardDot[] = [];
  let key = 0;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      const jitter = ((row * 17 + col * 31) % 11) - 5;
      const x = 4 + col * 7 + jitter * 0.35;
      const y = 6 + row * 10 + ((col % 3) - 1) * 1.5;
      if (x < 2 || x > 98 || y < 2 || y > 98) continue;
      const r = 0.55 + ((row + col) % 3) * 0.25;
      const opacity = 0.08 + ((row * col) % 5) * 0.03;
      dots.push({ x, y, r, opacity, key: key++ });
    }
  }
  return dots;
}

/** Two clean concentric dotted circles around the avatar.
 *  Inner ring + outer ring — simple, proper, no overcomplication.
 */
export function meetCardHaloDots(): MeetCardDot[] {
  const dots: MeetCardDot[] = [];
  let key = 0;
  const cx = 50;
  const cy = 50;

  // --- Inner circle ---
  const innerCount = 52;
  const innerRadius = 30;
  for (let i = 0; i < innerCount; i++) {
    const angle = (i / innerCount) * Math.PI * 2;
    // Every ~5th dot slightly larger for accent
    const r = i % 5 === 0 ? 1.6 : 1.0;
    const opacity = i % 5 === 0 ? 0.75 : 0.5;
    dots.push({
      x: cx + Math.cos(angle) * innerRadius,
      y: cy + Math.sin(angle) * innerRadius,
      r,
      opacity,
      key: key++,
    });
  }

  // --- Outer circle ---
  const outerCount = 72;
  const outerRadius = 44;
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2;
    // Every ~6th dot larger for accent
    const r = i % 6 === 0 ? 1.8 : i % 3 === 0 ? 1.2 : 0.85;
    const opacity = i % 6 === 0 ? 0.85 : i % 3 === 0 ? 0.6 : 0.4;
    dots.push({
      x: cx + Math.cos(angle) * outerRadius,
      y: cy + Math.sin(angle) * outerRadius,
      r,
      opacity,
      key: key++,
    });
  }

  return dots;
}
