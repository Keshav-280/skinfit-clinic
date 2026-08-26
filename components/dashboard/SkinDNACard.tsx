"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleDot,
  Droplets,
  FileText,
  Fingerprint,
  Leaf,
  Minus,
  Palette,
  Sparkles,
  Target,
  Waves,
} from "lucide-react";
import { differenceInCalendarDays, formatDistanceToNow, parseISO } from "date-fns";
import {
  classifySkinParamMetric,
  patientKaiScoreView,
  patientScoreView,
} from "@/src/lib/clarityGrade";
import { resolveScanDisplayScores } from "@/src/lib/resolveScanDisplayScores";
import { scoreDetailHref } from "@/src/lib/skinConcernSlug";

export type SkinDNAParamKey =
  | "acne"
  | "pigmentation"
  | "wrinkles"
  | "hydration"
  | "texture";

const PARAM_TILES: {
  key: SkinDNAParamKey;
  label: string;
  fullLabel: string;
  slugKey: string;
  Icon: LucideIcon;
}[] = [
  {
    key: "acne",
    label: "Acne",
    fullLabel: "Acne",
    slugKey: "acne",
    Icon: CircleDot,
  },
  {
    key: "pigmentation",
    label: "Pigment",
    fullLabel: "Pigmentation",
    slugKey: "pigmentation",
    Icon: Palette,
  },
  {
    key: "wrinkles",
    label: "Wrinkles",
    fullLabel: "Wrinkles",
    slugKey: "wrinkles",
    Icon: Waves,
  },
  {
    key: "hydration",
    label: "Hydration",
    fullLabel: "Hydration",
    slugKey: "hydration",
    Icon: Droplets,
  },
  {
    key: "texture",
    label: "Texture",
    fullLabel: "Texture",
    slugKey: "texture",
    Icon: Fingerprint,
  },
];

function readNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pull Acne / Pigmentation / Wrinkles / Hydration / Texture from latest scan JSON. */
export function skinDnaParamsFromAnalysis(
  analysis: unknown
): Record<SkinDNAParamKey, number> {
  const a =
    analysis && typeof analysis === "object"
      ? (analysis as Record<string, unknown>)
      : {};
  const resolved = resolveScanDisplayScores({
    scoresJson: a,
    baseMetricsColumns: {
      overallScore: readNum(a, "overallScore") ?? 0,
      acne: readNum(a, "acne") ?? 0,
      wrinkles: readNum(a, "wrinkles") ?? 0,
      pigmentation: readNum(a, "pigmentation") ?? 0,
      hydration: readNum(a, "hydration") ?? 0,
      texture: readNum(a, "texture") ?? 0,
    },
  });
  const m = resolved.metrics;
  return {
    acne: Math.min(100, Math.max(0, Math.round(m.acne))),
    pigmentation: Math.min(100, Math.max(0, Math.round(m.pigmentation))),
    wrinkles: Math.min(100, Math.max(0, Math.round(m.wrinkles))),
    hydration: Math.min(100, Math.max(0, Math.round(m.hydration))),
    texture: Math.min(100, Math.max(0, Math.round(m.texture))),
  };
}

/** Fitzpatrick type → friendly tone label (e.g. "Medium tone"). */
export function fitzpatrickToneLabel(
  fitz: string | null | undefined
): string | null {
  const t = fitz?.trim().toUpperCase();
  if (!t) return null;
  if (t === "I" || t === "II" || t === "1" || t === "2") return "Light tone";
  if (t === "III" || t === "3") return "Medium tone";
  if (t === "IV" || t === "4") return "Medium-deep tone";
  if (t === "V" || t === "VI" || t === "5" || t === "6") return "Deep tone";
  return `Type ${t}`;
}

/** Short tone for identity strip, e.g. "Medium". */
function shortToneLabel(fitz: string | null | undefined): string | null {
  const full = fitzpatrickToneLabel(fitz);
  if (!full) return null;
  return full.replace(/\s+tone$/i, "").trim() || full;
}

/** Capitalize the first letter of each word (values often arrive lowercase). */
function toTitleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function formatConcernLabel(concern: string): string {
  const c = concern.trim();
  if (!c) return c;
  if (/acne/i.test(c) && !/prone/i.test(c)) return "Acne-prone";
  return c;
}

/** One-line profile summary, e.g. "Oily · Acne-prone · Medium tone". */
export function formatSkinDnaSummary(input: {
  skinType?: string | null;
  primaryConcern?: string | null;
  fitzpatrick?: string | null;
}): string | null {
  const parts: string[] = [];
  const skin = input.skinType?.trim();
  if (skin) parts.push(toTitleCase(skin));
  const concern = input.primaryConcern?.trim();
  if (concern) parts.push(toTitleCase(formatConcernLabel(concern)));
  const tone = fitzpatrickToneLabel(input.fitzpatrick);
  if (tone) parts.push(tone);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function relativeScanLabel(iso: string | null | undefined): string {
  if (!iso?.trim()) return "No scan yet";
  try {
    const rel = formatDistanceToNow(parseISO(iso), { addSuffix: true });
    return rel ? rel[0]!.toUpperCase() + rel.slice(1) : rel;
  } catch {
    return "No scan yet";
  }
}

export type SkinDNACardProps = {
  patientName: string;
  profileImageUrl?: string | null;
  gender?: string | null;
  kaiSkinScore: number;
  scoresUnlocked: boolean;
  /** Latest scan `analysisResults` — used when `params` is omitted. */
  analysisResults?: unknown;
  /** Optional pre-extracted raw param scores (0–100). */
  params?: Partial<Record<SkinDNAParamKey, number>>;
  /** @deprecated Prefer structured identity props; still used as fallback line. */
  skinSummary?: string | null;
  skinType?: string | null;
  primaryConcern?: string | null;
  fitzpatrick?: string | null;
  weeklyDeltaScore?: number;
  weeklyDeltaMeaningful?: boolean;
  streakCurrent?: number;
  lastScanAt?: string | null;
  scanCount?: number;
  href?: string;
  className?: string;
  /** When false, param tiles render as — without requiring a scan. */
  hasScan?: boolean;
};

type SkinTypeKey = "oily" | "dry" | "combination" | "normal" | "sensitive";

const SKIN_TYPE_PALETTE: Record<SkinTypeKey, { fill: string; stroke: string }> = {
  oily: { fill: "#F6C453", stroke: "#C4892B" },
  dry: { fill: "#BEEAE4", stroke: "#2E9B8F" },
  combination: { fill: "#BEEAE4", stroke: "#2E9B8F" },
  normal: { fill: "#FBF6EA", stroke: "#8B8680" },
  sensitive: { fill: "#F7C3C3", stroke: "#D25C5C" },
};

function resolveSkinTypeKey(skinType: string | null | undefined): SkinTypeKey | null {
  const s = skinType?.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("oily")) return "oily";
  if (s.includes("dry")) return "dry";
  if (s.includes("combo") || s.includes("combination")) return "combination";
  if (s.includes("sensitiv")) return "sensitive";
  if (s.includes("normal")) return "normal";
  return null;
}

/** Cute blob-face icon for a skin type — small decorative marker next to the "Skin Type" fact. */
function SkinTypeIcon({ type }: { type: SkinTypeKey }) {
  const { fill, stroke } = SKIN_TYPE_PALETTE[type];
  const blobPath =
    "M16 2.5c2.6 0 4.3 2.1 4.9 2.9 1.3 1.1 6.6 3.8 6.6 10.4 0 6.4-5.2 11.7-11.5 11.7S4.5 22.2 4.5 15.8c0-6.6 5.3-9.3 6.6-10.4.6-.8 2.3-2.9 4.9-2.9Z";

  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
      <path d={blobPath} fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />

      {type === "combination" ? (
        <path
          d="M16 2.5c2.6 0 4.3 2.1 4.9 2.9.9.7 3.6 2.4 5.3 5.7-2.7-1.1-6-1.2-8.6.2-1.9 1-4 1-5.9.1-2.7-1.3-6.1-1.2-8.9-.1 1.7-3.2 4.3-4.9 5.2-5.9.6-.8 2.3-2.9 4.9-2.9Z"
          fill="#F6C453"
          stroke="#C4892B"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      ) : null}

      {type === "oily" ? (
        <path
          d="M23 18.5c1.3 1.4 2 2.6 2 3.7 0 1.5-1.1 2.5-2.4 2.5s-2.3-1-2.3-2.5c0-1.1.7-2.3 1.9-3.7.3-.3.6-.3.8 0Z"
          fill="#F6C453"
          stroke="#C4892B"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      ) : null}

      {type === "dry" ? (
        <path d="M9.5 12.5c-.8 1.4-1.3 2.5-1.1 3.4" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
      ) : null}

      {type === "normal" || type === "sensitive" ? (
        <>
          <circle cx="10.5" cy="18.5" r="1.9" fill={type === "sensitive" ? "#E88888" : "#F3B8B8"} opacity="0.75" />
          <circle cx="21.5" cy="18.5" r="1.9" fill={type === "sensitive" ? "#E88888" : "#F3B8B8"} opacity="0.75" />
        </>
      ) : null}

      {/* face */}
      <circle cx="12.3" cy="16" r="1.15" fill="#2A2420" />
      <circle cx="19.7" cy="16" r="1.15" fill="#2A2420" />
      <path d="M12.3 19.3c1 1.1 6.4 1.1 7.4 0" stroke="#2A2420" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

type ResolvedGender = "male" | "female" | null;

function resolveGender(gender: string | null | undefined): ResolvedGender {
  const g = gender?.trim().toLowerCase();
  if (!g) return null;
  if (g.startsWith("m")) return "male";
  if (g.startsWith("f") || g.startsWith("w")) return "female";
  return null;
}

/**
 * Human tech-avatar — a friendly person with skin tone, hair, and visible
 * eyes behind translucent smart glasses, used in place of initials/photo.
 * Gender tweaks hair style + a hue for the glow accents. The glasses lenses
 * pulse with a soft glow and a hand gives an occasional wave.
 */
function AvatarIcon({ gender }: { gender: "male" | "female" }) {
  const glow = gender === "female" ? "#F472B6" : "#22D3EE";
  const gradientFrom = gender === "female" ? "#7C3AED" : "#2563EB";
  const gradientTo = gender === "female" ? "#DB2777" : "#06B6D4";
  const hair = gender === "female" ? "#3B2A22" : "#2A1F1A";
  const skin = "#EFC29B";
  const clothing = gender === "female" ? "#DB2777" : "#2563EB";
  const gradId = `avatarGrad-${gender}`;
  const glowId = `avatarGlow-${gender}`;

  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={gradientFrom} />
          <stop offset="1" stopColor={gradientTo} />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="32" cy="32" r="32" fill={`url(#${gradId})`} />

      {/* shoulders / collar */}
      <path d="M14 64c0-9.9 8.1-17 18-17s18 7.1 18 17" fill={clothing} />

      {/* neck */}
      <rect x="27.5" y="39" width="9" height="8" fill={skin} />

      {/* ears */}
      <circle cx="18.5" cy="30" r="2.6" fill={skin} />
      <circle cx="45.5" cy="30" r="2.6" fill={skin} />

      {/* head — tapered jaw reads as an adult face rather than a round baby face */}
      <path
        d="M32 12.5c6.9 0 11.7 5.4 11.7 12.7 0 4.2-1 7.8-2.7 10.4-1.9 3-5.2 5.6-9 5.6s-7.1-2.6-9-5.6c-1.7-2.6-2.7-6.2-2.7-10.4 0-7.3 4.8-12.7 11.7-12.7Z"
        fill={skin}
      />

      {/* hair — mature, side-parted styles rather than a blunt helmet shape */}
      {gender === "female" ? (
        <path
          d="M17.3 25.5c-.7-9.4 5.8-15.5 14.7-15.5s15.4 6.1 14.7 15.5c-.2 2.9-1 5-1.9 6.4-.4-2.8-1.5-4.6-3-5.4.3-1.3.2-2.5-.4-3.4-3.4 1.9-7.9 1.9-11.4-.3-3.2-2-6.9-1.8-9.3.9-.5 2-.4 4.4 0 6.2-.9-1.4-1.7-3.4-1.9-4.4Zm-.6 3c1.2 6.4 3.4 11.6 4.7 13.7.7-2 .6-4.6.3-6-1.6-1.4-3.1-3.7-4.3-6.7-.3-.3-.5-.6-.7-1Zm29.6 0c-.2.4-.4.7-.7 1-1.2 3-2.7 5.3-4.3 6.7-.3 1.4-.4 4 .3 6 1.3-2.1 3.5-7.3 4.7-13.7Z"
          fill={hair}
        />
      ) : (
        <path
          d="M18.6 24.8c-.6-8 5.5-13.8 13.4-13.8 6 0 11 3.4 12.8 8.4-2.1-1.5-4.7-1.9-7.4-1-3.9 1.3-8.4.9-12-1-2.4-1.3-5.4-.7-6.8 1.6Z"
          fill={hair}
        />
      )}

      {/* eyebrows */}
      <path d="M23.7 27.8c1.3-.7 2.7-.7 3.8-.1" stroke={hair} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M36.5 27.7c1.1-.6 2.5-.6 3.8.1" stroke={hair} strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* smart glasses — translucent lenses so the eyes read through */}
      <rect x="19.5" y="29.6" width="25" height="2.4" rx="1.2" fill="#1E232C" />
      <circle cx="24.7" cy="32.8" r="4.7" fill="#1E232C" fillOpacity="0.12" />
      <circle cx="39.3" cy="32.8" r="4.7" fill="#1E232C" fillOpacity="0.12" />
      <circle cx="24.7" cy="32.8" r="1.1" fill={hair} />
      <circle cx="39.3" cy="32.8" r="1.1" fill={hair} />
      <motion.circle
        cx="24.7"
        cy="32.8"
        r="4.7"
        fill="none"
        stroke={glow}
        strokeWidth="1.3"
        filter={`url(#${glowId})`}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx="39.3"
        cy="32.8"
        r="4.7"
        fill="none"
        stroke={glow}
        strokeWidth="1.3"
        filter={`url(#${glowId})`}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
      />

      {/* nose + a restrained smile */}
      <path d="M31.3 34c0 1.2.5 2 1.4 2" stroke="#D9A876" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M28.3 39.5c.9 1 6 1 6.9 0" stroke="#7A3B2E" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* waving hand */}
      <motion.g
        style={{ transformOrigin: "50px 44px" }}
        animate={{ rotate: [0, 20, 0, 20, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
      >
        <rect x="47.5" y="44" width="5" height="12" rx="2.5" fill={clothing} />
        <circle cx="50" cy="43" r="4.4" fill={skin} />
      </motion.g>
    </svg>
  );
}

function TrendChip({
  weeklyDeltaScore,
  weeklyDeltaMeaningful,
}: {
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful: boolean;
}) {
  if (!weeklyDeltaMeaningful) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        Steady
      </span>
    );
  }
  const up = weeklyDeltaScore > 0;
  const flat = weeklyDeltaScore === 0;
  if (flat) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        Steady
      </span>
    );
  }
  if (up) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        +{Math.abs(Math.round(weeklyDeltaScore))} this week
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-400/40 bg-red-400/15 px-2.5 py-1 text-[11px] font-bold text-red-200">
      <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
      −{Math.abs(Math.round(weeklyDeltaScore))} this week
    </span>
  );
}

/** Last-scan recency, color-coded: fresh (0–6d) green, ageing (7–10d) amber, stale (11d+) red. */
function lastScanRecency(
  iso: string | null | undefined
): { colorClass: string } | null {
  if (!iso?.trim()) return null;
  let days: number;
  try {
    days = differenceInCalendarDays(new Date(), parseISO(iso));
  } catch {
    return null;
  }
  if (days <= 6) return { colorClass: "text-emerald-300" };
  if (days <= 10) return { colorClass: "text-amber-300" };
  return { colorClass: "text-red-300" };
}

/** Cycles through a list of strings every `intervalMs`, fading between them. */
function useRotatingMessage(messages: string[], intervalMs = 4500): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [messages.length, intervalMs]);
  return messages[index % messages.length] ?? "";
}

/** Data-driven insight lines — no fabricated numbers, only what the props actually give us. */
function buildInsightMessages(input: {
  strongest: { name: string } | null;
  needsFocus: { name: string } | null;
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful: boolean;
  streakCurrent?: number;
}): string[] {
  const messages: string[] = [];
  if (input.weeklyDeltaMeaningful && input.weeklyDeltaScore > 0) {
    messages.push(
      `Your skin score improved ${Math.abs(Math.round(input.weeklyDeltaScore))} points this week`
    );
  }
  if (input.strongest) {
    messages.push(`${input.strongest.name} is your most stable metric`);
  }
  if (input.needsFocus) {
    messages.push(`${input.needsFocus.name} is your biggest opportunity`);
  }
  if (typeof input.streakCurrent === "number" && input.streakCurrent > 0) {
    messages.push(
      `You're on a ${input.streakCurrent}-day streak — keep it going`
    );
  }
  if (messages.length === 0) {
    messages.push("You're maintaining your progress well");
  }
  return messages;
}

/** Reusable animated SVG ring: sweeps 0 -> pct on mount, then settles into a slow breathing pulse. */
function CircleRing({
  pct,
  size,
  strokeWidth,
  color,
  trackColor = "rgba(255,255,255,0.12)",
  animateKick,
  children,
}: {
  pct: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  /** True to re-trigger a brief pulse (e.g. while hovered). */
  animateKick?: boolean;
  children?: ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <motion.div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      animate={
        animateKick
          ? { scale: [1, 1.06, 1] }
          : { scale: [1, 1.015, 1] }
      }
      transition={
        animateKick
          ? { duration: 0.45, ease: "easeInOut" }
          : { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }
      }
      key={animateKick ? "kick" : "breathe"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference * (1 - clamped / 100),
          }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {/* Two small particles orbiting the ring on mount, fading out after a couple of loops. */}
      <div
        className="pointer-events-none absolute inset-0 animate-[dna-ring-orbit_1.4s_linear_2_forwards]"
        style={{ opacity: 1 }}
      >
        <span
          className="absolute h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.6)]"
          style={{ left: "50%", top: 0, transform: "translate(-50%, -50%)" }}
        />
        <span
          className="absolute h-1 w-1 rounded-full bg-white/80"
          style={{ left: "50%", bottom: 0, transform: "translate(-50%, 50%)" }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </motion.div>
  );
}

type ParamTileData = {
  key: SkinDNAParamKey;
  label: string;
  fullLabel: string;
  slugKey: string;
  Icon: LucideIcon;
  raw: number;
  grade: string;
  sublabel: string;
  color: string;
  href: string | null;
};

/** One param tile — expands and shows a qualitative status on hover/tap; dims when a sibling is active. */
function InteractiveParamTile({
  tile,
  hasScan,
  isActive,
  isDimmed,
  onActivate,
  onDeactivate,
}: {
  tile: ParamTileData;
  hasScan: boolean;
  isActive: boolean;
  isDimmed: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const statusLine =
    tile.grade === "A" || tile.grade === "B"
      ? "Tracking well"
      : tile.grade === "C"
        ? "Worth watching"
        : "Needs attention";

  const inner = (
    <motion.div
      layout
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onClick={onActivate}
      animate={{
        opacity: isDimmed ? 0.55 : 1,
        scale: isActive ? 1.06 : 1,
      }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-0 flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-2.5 text-center sm:w-auto"
      style={isActive ? { zIndex: 10 } : undefined}
    >
      <CircleRing
        pct={hasScan ? tile.raw : 0}
        size={44}
        strokeWidth={4}
        color={hasScan ? tile.color : "#4B5563"}
        animateKick={isActive}
      >
        <span
          className="text-sm font-extrabold leading-none tabular-nums"
          style={{ color: hasScan ? tile.color : "#9CA3AF" }}
        >
          {hasScan ? tile.grade : "—"}
        </span>
      </CircleRing>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-white/60">
        {tile.label}
      </span>
      <AnimatePresence>
        {isActive && hasScan ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-[9.5px] font-semibold leading-snug text-white/80">
              {tile.sublabel}
            </p>
            <p className="text-[9px] leading-snug text-white/50">{statusLine}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );

  if (tile.href && hasScan) {
    return (
      <Link href={tile.href} className="contents">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function SkinDNACard({
  patientName,
  profileImageUrl = null,
  gender = null,
  kaiSkinScore,
  scoresUnlocked,
  analysisResults,
  params: paramsProp,
  skinSummary = null,
  skinType = null,
  primaryConcern = null,
  fitzpatrick = null,
  weeklyDeltaScore = 0,
  weeklyDeltaMeaningful = false,
  streakCurrent,
  lastScanAt = null,
  scanCount,
  href = "/dashboard/history",
  className = "",
  hasScan = true,
}: SkinDNACardProps) {
  const kai = patientKaiScoreView(kaiSkinScore, scoresUnlocked);
  const fromAnalysis =
    hasScan && analysisResults
      ? skinDnaParamsFromAnalysis(analysisResults)
      : null;
  const params: Record<SkinDNAParamKey, number> = {
    acne: paramsProp?.acne ?? fromAnalysis?.acne ?? 0,
    pigmentation: paramsProp?.pigmentation ?? fromAnalysis?.pigmentation ?? 0,
    wrinkles: paramsProp?.wrinkles ?? fromAnalysis?.wrinkles ?? 0,
    hydration: paramsProp?.hydration ?? fromAnalysis?.hydration ?? 0,
    texture: paramsProp?.texture ?? fromAnalysis?.texture ?? 0,
  };
  const displayName = patientName.trim() || "Patient";
  const photo = profileImageUrl?.trim() || null;
  const identityFacts: { label: string; value: string; icon?: ReactNode }[] = [];
  const typeVal = skinType?.trim();
  const skinTypeKey = resolveSkinTypeKey(typeVal);
  if (typeVal)
    identityFacts.push({
      label: "Skin Type",
      value: toTitleCase(typeVal),
      icon: skinTypeKey ? <SkinTypeIcon type={skinTypeKey} /> : undefined,
    });
  const toneVal = shortToneLabel(fitzpatrick);
  if (toneVal) identityFacts.push({ label: "Tone", value: toTitleCase(toneVal) });
  const concernVal = primaryConcern?.trim();
  if (concernVal)
    identityFacts.push({ label: "Focus", value: toTitleCase(concernVal) });
  identityFacts.push({
    label: "Last scan",
    value: hasScan ? relativeScanLabel(lastScanAt) : "No scan yet",
  });
  if (typeof streakCurrent === "number" && streakCurrent > 0) {
    identityFacts.push({
      label: "Streak",
      value: `${streakCurrent} day${streakCurrent === 1 ? "" : "s"}`,
    });
  }
  if (typeof scanCount === "number" && scanCount > 0) {
    identityFacts.push({
      label: "Scans",
      value: String(scanCount),
    });
  }

  let strongest: { name: string; gradeLabel: string } | null = null;
  let needsFocus: { name: string; gradeLabel: string } | null = null;

  if (hasScan) {
    const ranked = PARAM_TILES.map((t) => ({
      ...t,
      raw: params[t.key],
      view: patientScoreView(params[t.key], scoresUnlocked),
    })).sort((a, b) => b.raw - a.raw);

    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    strongest = {
      name: best.fullLabel,
      gradeLabel: `Grade ${best.view.grade}`,
    };
    if (best.key !== worst.key) {
      needsFocus = {
        name: worst.fullLabel,
        gradeLabel: `Grade ${worst.view.grade}`,
      };
    }
  }

  const resolvedGender = resolveGender(gender);
  const recency = lastScanRecency(lastScanAt);

  const paramTiles: ParamTileData[] = PARAM_TILES.map((t) => {
    const raw = params[t.key];
    const metric = classifySkinParamMetric(raw);
    const view = patientScoreView(raw, scoresUnlocked);
    return {
      key: t.key,
      label: t.label,
      fullLabel: t.fullLabel,
      slugKey: t.slugKey,
      Icon: t.Icon,
      raw,
      grade: view.grade,
      sublabel: toTitleCase(metric.sublabel),
      color: metric.color,
      href: scoreDetailHref(t.slugKey),
    };
  });

  const insightMessages = buildInsightMessages({
    strongest,
    needsFocus,
    weeklyDeltaScore,
    weeklyDeltaMeaningful,
    streakCurrent,
  });
  const headlineMessage = useRotatingMessage(insightMessages, 5000);
  const ringInsight = useRotatingMessage(
    insightMessages.length > 1 ? [...insightMessages.slice(1), insightMessages[0]!] : insightMessages,
    5000
  );
  const tipMessage = useRotatingMessage(
    insightMessages.length > 2
      ? [...insightMessages.slice(2), ...insightMessages.slice(0, 2)]
      : insightMessages,
    5000
  );
  const [activeParam, setActiveParam] = useState<SkinDNAParamKey | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1330] via-[#0F1A3D] to-[#0B1330] shadow-lg ring-1 ring-white/[0.06] transition-shadow duration-200 hover:shadow-xl ${className}`}
    >
      {/* 1. Header */}
      <div className="relative overflow-hidden px-4 pb-4 pt-4 sm:px-5">
        <svg
          className="pointer-events-none absolute -right-6 -top-8 h-40 w-40 opacity-[0.08]"
          viewBox="0 0 200 200"
          fill="none"
          aria-hidden
        >
          <circle cx="100" cy="100" r="99" stroke="white" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="70" stroke="white" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="41" stroke="white" strokeWidth="1.5" />
        </svg>

        <div className="relative flex items-start gap-3 sm:gap-3.5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white/25 ring-offset-2 ring-offset-[#0F1A3D]">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : resolvedGender ? (
              <AvatarIcon gender={resolvedGender} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/10 text-sm font-bold tracking-wide text-white">
                {initialsFromName(displayName)}
              </div>
            )}
          </div>

          {/* Name + rotating insight line */}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-lg font-bold leading-tight text-white">
              {displayName}
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={hasScan ? headlineMessage : "no-scan"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                className="mt-0.5 flex items-center gap-1 truncate text-[12px] font-medium text-white/60"
              >
                <Sparkles className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
                {hasScan
                  ? headlineMessage
                  : skinSummary?.trim() || "Unlock your skin potential"}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Score widget — animated ring gauge */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <CircleRing
              pct={kai.showLock ? 0 : kaiSkinScore}
              size={56}
              strokeWidth={4}
              color={kai.color}
              trackColor="rgba(255,255,255,0.12)"
            >
              <div className="flex h-[42px] w-[42px] flex-col items-center justify-center rounded-full bg-[#0F1A3D]">
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="text-lg font-extrabold leading-none tabular-nums text-white"
                >
                  {kai.showLock ? kai.grade : Math.round(kaiSkinScore)}
                </motion.span>
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-white/50">
                  {kai.showLock ? "Locked" : toTitleCase(kai.sublabel)}
                </span>
              </div>
            </CircleRing>
            <TrendChip
              weeklyDeltaScore={weeklyDeltaScore}
              weeklyDeltaMeaningful={weeklyDeltaMeaningful}
            />
          </div>
        </div>
      </div>

      {/* 2. Identity strip */}
      {identityFacts.length > 0 ? (
        <div className="mx-4 flex gap-0 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] scrollbar-hide sm:mx-5">
          {identityFacts.map((fact, i) => (
            <div
              key={fact.label}
              className={`flex min-w-[4.5rem] flex-1 items-center gap-2 px-3 py-2.5 ${
                i > 0 ? "border-l border-white/10" : ""
              }`}
            >
              {fact.icon}
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  {fact.label}
                </span>
                <span
                  className={`mt-0.5 truncate text-[13px] font-bold ${
                    fact.label === "Last scan" && recency
                      ? recency.colorClass
                      : "text-white"
                  }`}
                >
                  {fact.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* 3. Strongest / overall ring / needs focus */}
      {hasScan ? (
        <div className="mx-4 mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 sm:mx-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          {strongest ? (
            <div className="flex min-w-0 shrink-0 items-center gap-2.5">
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 sm:flex">
                <Leaf className="h-4 w-4" aria-hidden />
              </span>
              <div className="w-24 min-w-0 sm:w-28">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">
                  Strongest
                </p>
                <p className="mt-0.5 truncate text-[13px] font-bold leading-snug text-white">
                  {strongest.name}
                </p>
                <p className="text-[11px] font-medium text-white/40">
                  {strongest.gradeLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-24 sm:w-28" />
          )}

          <CircleRing
            pct={kai.showLock ? 0 : kaiSkinScore}
            size={84}
            strokeWidth={6}
            color={kai.color}
            trackColor="rgba(255,255,255,0.1)"
          >
            <div className="flex flex-col items-center justify-center">
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="text-2xl font-extrabold leading-none text-white"
              >
                {kai.showLock ? kai.grade : Math.round(kaiSkinScore)}
              </motion.span>
              <span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-white/50">
                Overall
              </span>
            </div>
          </CircleRing>

          {needsFocus ? (
            <div className="flex min-w-0 shrink-0 items-center gap-2.5">
              <div className="w-24 min-w-0 text-right sm:w-28">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80">
                  Needs focus
                </p>
                <p className="mt-0.5 truncate text-[13px] font-bold leading-snug text-white">
                  {needsFocus.name}
                </p>
                <p className="text-[11px] font-medium text-white/40">
                  {needsFocus.gradeLabel}
                </p>
              </div>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 sm:flex">
                <Target className="h-4 w-4" aria-hidden />
              </span>
            </div>
          ) : (
            <div className="w-24 sm:w-28" />
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={ringInsight}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35 }}
            className="mt-4 border-t border-white/10 pt-3 text-center text-[12px] font-medium text-white/45"
          >
            {ringInsight}
          </motion.p>
        </AnimatePresence>
        </div>
      ) : null}

      {!hasScan ? (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3.5 py-3 sm:mx-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <svg className="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">Complete your Skin DNA</p>
            <p className="text-xs text-white/50">Take a 2-min scan to unlock your score &amp; insights</p>
          </div>
        </div>
      ) : null}

      {/* 4. Interactive param tiles */}
      <div
        className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-5"
        onMouseLeave={() => setActiveParam(null)}
      >
        {paramTiles.map((tile) => (
          <InteractiveParamTile
            key={tile.key}
            tile={tile}
            hasScan={hasScan}
            isActive={activeParam === tile.key}
            isDimmed={activeParam !== null && activeParam !== tile.key}
            onActivate={() => setActiveParam(tile.key)}
            onDeactivate={() =>
              setActiveParam((cur) => (cur === tile.key ? null : cur))
            }
          />
        ))}
      </div>

      {/* 5. Footer */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-white transition hover:underline"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          View full report
          <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Link>
        {hasScan ? (
          <AnimatePresence mode="wait">
            <motion.p
              key={tipMessage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35 }}
              className="min-w-0 truncate text-right text-[12px] font-medium text-white/50"
            >
              ✦ {tipMessage}
            </motion.p>
          </AnimatePresence>
        ) : null}
      </div>
    </motion.div>
  );
}
