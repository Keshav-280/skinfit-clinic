/** Shared visual tokens + dot layouts for the Meet kAI intro card (web + mobile). */

export const KAI_MEET_CARD = {
  radius: 20,
  /** Desktop min height — taller hero card. */
  minHeightWide: 460,
  minHeightPhone: 220,
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

/** Four clean concentric dotted circles around the avatar. */
export function meetCardHaloDots(): MeetCardDot[] {
  const dots: MeetCardDot[] = [];
  let key = 0;
  const cx = 50;
  const cy = 50;

  const rings = [
    { radius: 20, count: 36,  dotR: 0.70, accentR: 1.10, opacity: 0.22, accentOpacity: 0.36, accentEvery: 6 },
    { radius: 30, count: 54,  dotR: 0.75, accentR: 1.20, opacity: 0.32, accentOpacity: 0.48, accentEvery: 6 },
    { radius: 40, count: 72,  dotR: 0.80, accentR: 1.30, opacity: 0.42, accentOpacity: 0.60, accentEvery: 6 },
    { radius: 50, count: 90,  dotR: 0.85, accentR: 1.40, opacity: 0.52, accentOpacity: 0.72, accentEvery: 6 },
    { radius: 60, count: 108, dotR: 0.90, accentR: 1.50, opacity: 0.62, accentOpacity: 0.84, accentEvery: 6 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2;
      const isAccent = i % ring.accentEvery === 0;
      dots.push({
        x: cx + Math.cos(angle) * ring.radius,
        y: cy + Math.sin(angle) * ring.radius,
        r: isAccent ? ring.accentR : ring.dotR,
        opacity: isAccent ? ring.accentOpacity : ring.opacity,
        key: key++,
      });
    }
  }

  return dots;
}
