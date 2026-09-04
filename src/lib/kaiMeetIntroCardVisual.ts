/** Shared visual tokens + dot layouts for the Meet kAI intro card (web + mobile). */

/** Full-page wash + particle aura for the web Meet kAI intro. */
export const KAI_INTRO_ATMOSPHERE = {
  left: "#A7A8D8",
  mid: "#6E81C6",
  right: "#3F5CAE",
  glow: "rgba(236, 242, 255, 0.58)",
  particle: "#FFFFFF",
  particleSoft: "#D4E2FF",
} as const;

export const KAI_MEET_CARD = {
  radius: 20,
  /** Desktop min height - taller hero card. */
  minHeightWide: 460,
  minHeightPhone: 340,
  gradient: {
    /** Radial spotlight glow behind the avatar. */
    glow: "rgba(218, 232, 255, 0.72)",
    mid: "#879BD4",
    edge: "#4A609F",
    deep: "#243B78",
  },
  text: {
    meet: "#1B2C5B",
    desc: "#3D4D7A",
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
    {
      radius: 18,
      count: 34,
      dotR: 0.62,
      accentR: 1.05,
      opacity: 0.2,
      accentOpacity: 0.38,
      accentEvery: 6,
    },
    {
      radius: 28,
      count: 52,
      dotR: 0.68,
      accentR: 1.15,
      opacity: 0.3,
      accentOpacity: 0.5,
      accentEvery: 6,
    },
    {
      radius: 38,
      count: 70,
      dotR: 0.74,
      accentR: 1.25,
      opacity: 0.42,
      accentOpacity: 0.64,
      accentEvery: 7,
    },
    {
      radius: 49,
      count: 90,
      dotR: 0.82,
      accentR: 1.42,
      opacity: 0.56,
      accentOpacity: 0.8,
      accentEvery: 6,
    },
    {
      radius: 60,
      count: 112,
      dotR: 0.88,
      accentR: 1.55,
      opacity: 0.7,
      accentOpacity: 0.95,
      accentEvery: 7,
    },
    {
      radius: 70,
      count: 128,
      dotR: 0.72,
      accentR: 1.45,
      opacity: 0.34,
      accentOpacity: 0.66,
      accentEvery: 8,
    },
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

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Soft circular star-field behind kAI — denser at the centre, sparse at the
 * rim, with a little ring structure so it reads as an aura rather than noise.
 */
export function meetCardAuraField(): MeetCardDot[] {
  const dots: MeetCardDot[] = [];
  const cx = 50;
  const cy = 49;
  let key = 0;

  for (let i = 0; i < 380; i += 1) {
    const angle = hash01(i) * Math.PI * 2;
    const radius = Math.pow(hash01(i + 333), 0.52) * 56;
    const jitter = (hash01(i + 777) - 0.5) * 2.4;
    const x = cx + Math.cos(angle) * (radius + jitter);
    const y = cy + Math.sin(angle) * (radius + jitter) * 0.9;
    const dist = Math.hypot(x - cx, (y - cy) / 0.9);
    const fade = Math.max(0, 1 - dist / 58);
    const sizeRoll = hash01(i + 111);
    const r = sizeRoll > 0.94 ? 1.45 : sizeRoll > 0.72 ? 0.82 : 0.42;
    dots.push({
      x,
      y,
      r,
      opacity: 0.1 + fade * (sizeRoll > 0.88 ? 0.78 : 0.5),
      key: key++,
    });
  }

  const rings = [
    { radius: 16, count: 28, r: 0.55, opacity: 0.28 },
    { radius: 26, count: 40, r: 0.62, opacity: 0.34 },
    { radius: 36, count: 52, r: 0.7, opacity: 0.38 },
    { radius: 46, count: 64, r: 0.78, opacity: 0.32 },
    { radius: 56, count: 72, r: 0.64, opacity: 0.2 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i += 1) {
      const angle =
        (i / ring.count) * Math.PI * 2 + hash01(i + ring.radius) * 0.12;
      const wobble = 1 + (hash01(i * 3 + ring.radius) - 0.5) * 0.08;
      dots.push({
        x: cx + Math.cos(angle) * ring.radius * wobble,
        y: cy + Math.sin(angle) * ring.radius * wobble * 0.9,
        r: ring.r + (i % 7 === 0 ? 0.45 : 0),
        opacity: ring.opacity + (i % 5 === 0 ? 0.18 : 0),
        key: key++,
      });
    }
  }

  return dots;
}
