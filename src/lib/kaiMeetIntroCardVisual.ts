/** Shared visual tokens + dot layouts for the Meet kAI intro card (web + mobile). */

export const KAI_MEET_CARD = {
  radius: 20,
  /** Desktop min height — taller hero card. */
  minHeightWide: 400,
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

/** Dense spiral + ring halo centered behind the avatar (viewBox 0–100). */
export function meetCardHaloDots(): MeetCardDot[] {
  const dots: MeetCardDot[] = [];
  let key = 0;
  const cx = 50;
  const cy = 52;

  // Spiral — denser at center, sparser outward (portal effect).
  const spiralCount = 160;
  for (let i = 0; i < spiralCount; i += 1) {
    const t = i / spiralCount;
    const angle = t * Math.PI * 7.5;
    const radius = 6 + t * 44;
    dots.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.92,
      r: 0.7 + (1 - t) * 2.4,
      opacity: 0.2 + (1 - t) * 0.65,
      key: key++,
    });
  }

  // Outer ring accents.
  const ringCount = 56;
  for (let i = 0; i < ringCount; i += 1) {
    const angle = (i / ringCount) * Math.PI * 2;
    const radius = 44 + (i % 4) * 1.2;
    dots.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.92,
      r: i % 5 === 0 ? 2.2 : i % 2 === 0 ? 1.4 : 0.9,
      opacity: 0.25 + (i % 6) * 0.08,
      key: key++,
    });
  }

  return dots;
}
