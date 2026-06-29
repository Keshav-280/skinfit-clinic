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

/** Wide circular orbit of dots centered behind the avatar (viewBox 0–100).
 *  Matches target design: scattered stars in a large open circle around the character.
 */
export function meetCardHaloDots(): MeetCardDot[] {
  const dots: MeetCardDot[] = [];
  let key = 0;
  const cx = 50;
  const cy = 50;

  // --- Primary orbit ring (large, clean circle) ---
  const primaryCount = 72;
  for (let i = 0; i < primaryCount; i += 1) {
    const angle = (i / primaryCount) * Math.PI * 2;
    // Vary radius slightly so dots don't sit on a perfect mechanical ring
    const jitter = ((i * 13) % 7) - 3;
    const radius = 42 + jitter * 0.5;
    // Bigger dots with some size variety
    const r =
      i % 9 === 0 ? 2.2        // large accent dot
      : i % 4 === 0 ? 1.6      // medium dot
      : 1.1;                    // fine dot
    // High, uniform opacity — bright stars
    const opacity = 0.55 + ((i * 7) % 10) * 0.04;
    dots.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r,
      opacity,
      key: key++,
    });
  }

  // --- Scattered inner field — sparse fine dots inside the ring ---
  const innerCount = 48;
  for (let i = 0; i < innerCount; i += 1) {
    const angle = (i / innerCount) * Math.PI * 2 + 0.15;
    const radius = 14 + ((i * 11) % 24);
    dots.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: 0.7 + ((i * 3) % 5) * 0.22,
      opacity: 0.3 + ((i * 5) % 8) * 0.05,
      key: key++,
    });
  }

  // --- Outer scattered stars just beyond the ring ---
  const outerCount = 30;
  for (let i = 0; i < outerCount; i += 1) {
    const angle = (i / outerCount) * Math.PI * 2 + 0.4;
    const radius = 47 + ((i * 7) % 10);
    dots.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: i % 5 === 0 ? 1.8 : 0.9,
      opacity: 0.35 + ((i * 3) % 7) * 0.06,
      key: key++,
    });
  }

  return dots;
}
