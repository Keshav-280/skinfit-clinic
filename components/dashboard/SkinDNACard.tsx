"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  CircleDot,
  Eye,
  FileText,
  Layers,
  Leaf,
  Palette,
  ScanLine,
  Target,
  Waves,
} from "lucide-react";
import { differenceInCalendarDays, formatDistanceToNow, parseISO } from "date-fns";
import {
  classifySkinParamMetric,
  scoreOutOfTen,
} from "@/src/lib/clarityGrade";
import { RAG_KAI_PARAM_LABELS, type RagKaiParamKey } from "@/src/lib/ragEightParams";
import { resolveScanDisplayScores } from "@/src/lib/resolveScanDisplayScores";
import { scoreDetailHref } from "@/src/lib/skinConcernSlug";

/** The six patient-facing kAI parameters shown on the DNA card. */
export type SkinDNAParamKey = Exclude<
  RagKaiParamKey,
  "hair_health" | "skin_quality"
>;

const PARAM_TILES: {
  key: SkinDNAParamKey;
  label: string;
  fullLabel: string;
  slugKey: string;
  Icon: LucideIcon;
}[] = [
  {
    key: "active_acne",
    label: "Acne",
    fullLabel: RAG_KAI_PARAM_LABELS.active_acne,
    slugKey: "active_acne",
    Icon: CircleDot,
  },
  {
    key: "acne_scar",
    label: "Scars",
    fullLabel: RAG_KAI_PARAM_LABELS.acne_scar,
    slugKey: "acne_scar",
    Icon: ScanLine,
  },
  {
    key: "pigmentation",
    label: "Pigment",
    fullLabel: RAG_KAI_PARAM_LABELS.pigmentation,
    slugKey: "pigmentation",
    Icon: Palette,
  },
  {
    key: "wrinkles",
    label: "Wrinkles",
    fullLabel: RAG_KAI_PARAM_LABELS.wrinkles,
    slugKey: "wrinkles",
    Icon: Waves,
  },
  {
    key: "under_eye",
    label: "Under-eye",
    fullLabel: RAG_KAI_PARAM_LABELS.under_eye,
    slugKey: "under_eye",
    Icon: Eye,
  },
  {
    key: "sagging_volume",
    label: "Volume",
    fullLabel: RAG_KAI_PARAM_LABELS.sagging_volume,
    slugKey: "sagging_volume",
    Icon: Layers,
  },
];

function clampParamScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Brand ring colors - ink / blush / deep rose, no neon glow. */
function dnaRingColor(raw: number): string {
  const grade = classifySkinParamMetric(raw).grade;
  if (grade === "A" || grade === "B") return "#242A5F";
  if (grade === "C") return "#A05E6D";
  return "#4A2630";
}

function readNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pull the six patient-facing kAI parameters from latest scan JSON. */
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
  const rag = resolved.resolvedRagParamValues;
  const m = resolved.metrics;
  return {
    active_acne: clampParamScore(rag.active_acne ?? m.acne),
    acne_scar: clampParamScore(rag.acne_scar ?? m.texture),
    pigmentation: clampParamScore(rag.pigmentation ?? m.pigmentation),
    wrinkles: clampParamScore(rag.wrinkles ?? m.wrinkles),
    under_eye: clampParamScore(rag.under_eye ?? m.hydration),
    sagging_volume: clampParamScore(rag.sagging_volume ?? 0),
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
  /** Latest scan `analysisResults` - used when `params` is omitted. */
  analysisResults?: unknown;
  /** Optional pre-extracted raw param scores (0-100). */
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
  /** When false, param tiles render as - without requiring a scan. */
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

/** Cute blob-face icon for a skin type - small decorative marker next to the "Skin Type" fact. */
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

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export type ResolvedGender = "male" | "female" | null;

export function resolveGender(gender: string | null | undefined): ResolvedGender {
  const g = gender?.trim().toLowerCase();
  if (!g) return null;
  if (g.startsWith("m")) return "male";
  if (g.startsWith("f") || g.startsWith("w")) return "female";
  return null;
}

/**
 * Human tech-avatar - a friendly person with skin tone, hair, and visible
 * eyes behind translucent smart glasses, used in place of initials/photo.
 * Gender tweaks hair style + a hue for the glow accents. The glasses lenses
 * pulse with a soft glow and a hand gives an occasional wave.
 */
export function AvatarIcon({ gender }: { gender: "male" | "female" }) {
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

      {/* head - tapered jaw reads as an adult face rather than a round baby face */}
      <path
        d="M32 12.5c6.9 0 11.7 5.4 11.7 12.7 0 4.2-1 7.8-2.7 10.4-1.9 3-5.2 5.6-9 5.6s-7.1-2.6-9-5.6c-1.7-2.6-2.7-6.2-2.7-10.4 0-7.3 4.8-12.7 11.7-12.7Z"
        fill={skin}
      />

      {/* hair - mature, side-parted styles rather than a blunt helmet shape */}
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

      {/* smart glasses - translucent lenses so the eyes read through */}
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

/** Last-scan recency on light brand surfaces. */
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
  if (days <= 6) return { colorClass: "text-[#242A5F]" };
  if (days <= 10) return { colorClass: "text-[#A05E6D]" };
  return { colorClass: "text-[#4A2630]" };
}

/** Visible “vs last scan” copy on the 0-10 scale used everywhere else on this card. */
function lastScanImprovementCopy(
  weeklyDeltaScore: number,
  weeklyDeltaMeaningful: boolean,
  hasScan: boolean,
  scanCount?: number
): { value: string; detail: string } {
  if (!hasScan) {
    return { value: "-", detail: "Take a scan to start tracking change." };
  }
  if (!weeklyDeltaMeaningful || (typeof scanCount === "number" && scanCount < 2)) {
    return {
      value: "First scan",
      detail: "A second scan will show how your scores moved.",
    };
  }
  const onTen = Math.round(weeklyDeltaScore / 10);
  if (onTen > 0) {
    return {
      value: `+${onTen}`,
      detail: `Improved +${onTen} from last scan`,
    };
  }
  if (onTen < 0) {
    return {
      value: `${onTen}`,
      detail: `${onTen} from last scan`,
    };
  }
  if (weeklyDeltaScore > 0) {
    return { value: "Holding", detail: "Slight improvement from last scan" };
  }
  if (weeklyDeltaScore < 0) {
    return { value: "Holding", detail: "Slightly down from last scan" };
  }
  return { value: "No change", detail: "No change from last scan" };
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

function daysSinceScan(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  try {
    return differenceInCalendarDays(new Date(), parseISO(iso));
  } catch {
    return null;
  }
}

/** Six rotating insight lines - grounded in the scores and profile we actually have. */
function buildInsightMessages(input: {
  strongest: { name: string } | null;
  needsFocus: { name: string } | null;
  streakCurrent?: number;
  scanCount?: number;
  lastScanAt?: string | null;
  skinType?: string | null;
  primaryConcern?: string | null;
  overallTen: number;
  improvementDetail: string;
}): string[] {
  const lines: string[] = [];

  if (input.needsFocus) {
    lines.push(`${input.needsFocus.name} is your biggest opportunity`);
  }
  if (input.strongest) {
    lines.push(`${input.strongest.name} is your most stable metric`);
  }
  if (input.improvementDetail) {
    lines.push(input.improvementDetail);
  }
  lines.push(
    `Overall sits at ${input.overallTen}/10 - steady routine moves this more than a single scan`
  );

  const days = daysSinceScan(input.lastScanAt);
  if (days != null && days > 10) {
    lines.push(
      `Last scan was ${days} days ago - a weekly capture keeps the trend honest`
    );
  } else if (typeof input.scanCount === "number" && input.scanCount > 0) {
    lines.push(
      `${input.scanCount} scan${input.scanCount === 1 ? "" : "s"} on file - each one makes the next report sharper`
    );
  } else {
    lines.push("Weekly scans help kAI tell real change from a one-off day");
  }

  if (typeof input.streakCurrent === "number" && input.streakCurrent > 0) {
    lines.push(
      `You're on a ${input.streakCurrent}-day streak - keep it going`
    );
  }
  const concern = input.primaryConcern?.trim();
  if (concern) {
    lines.push(
      `Your focus is ${toTitleCase(concern)} - kAI watches that across scans`
    );
  }
  const skin = input.skinType?.trim();
  if (skin) {
    lines.push(
      `${toTitleCase(skin)} skin: keep AM and PM steps steady so scores can move`
    );
  }
  lines.push(
    "Keep AM and PM steps going so kAI can read the pattern, not a one-off day"
  );

  const unique: string[] = [];
  for (const line of lines) {
    if (line && !unique.includes(line)) unique.push(line);
  }
  while (unique.length < 6) {
    unique.push("Small, consistent habits show up here before big jumps do");
    if (unique.length < 6) {
      unique.push("Same angles, same lighting - that's how kAI compares week to week");
    }
  }
  return unique.slice(0, 6);
}

/** SVG progress ring - stroke only, no glow, particles, or breathing scale. */
function CircleRing({
  pct,
  size,
  strokeWidth,
  color,
  trackColor = "#E4E6F0",
  children,
}: {
  pct: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
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
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

type ParamTileData = {
  key: SkinDNAParamKey;
  label: string;
  fullLabel: string;
  slugKey: string;
  Icon: LucideIcon;
  raw: number;
  score: number;
  sublabel: string;
  color: string;
  href: string | null;
};

function paramHoverLine(key: SkinDNAParamKey, score: number): string {
  const high = score >= 7;
  const mid = score >= 4;
  switch (key) {
    case "active_acne":
      if (high) return "Breakouts are quiet - keep one gentle cleanser, skip a new active";
      if (mid) return "A few lesions still show - same night step beats stacking products";
      return "New breakouts are the focus - cream cleanser only until the next scan";
    case "acne_scar":
      if (high) return "Marks are fading slowly - same lighting next week keeps this honest";
      if (mid) return "Scars move on a longer cycle - hold the current night step steady";
      return "Texture here needs time - don't switch actives before the next capture";
    case "pigmentation":
      if (high) return "Tone is holding - midday SPF is what keeps this score up";
      if (mid) return "Marks still pick up UV - SPF at 9am, reapply if you're outdoors";
      return "Pigment is the one to watch - sunscreen every morning before anything else";
    case "wrinkles":
      if (high) return "Lines are quiet - sleep and a simple moisturiser matter more than a new cream";
      if (mid) return "Fine lines read here first - a fixed bedtime is the weekly lever";
      return "This marker moves slowly - 7 hours in bed beats adding another serum";
    case "under_eye":
      if (high) return "Under-eyes look settled - keep sleep hours in the same window";
      if (mid) return "Shadow still shows - one cool-hour bedtime beats a new eye cream";
      return "Puff and darkness need rest first - skip stacking another eye product";
    case "sagging_volume":
      if (high) return "Volume is holding - protein at meals supports this more than extra cream";
      if (mid) return "Firmness moves slowly - two short resistance sessions beat extra product";
      return "This marker needs months - keep protein in and the same scan setup";
  }
}

function SnapStrip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain touch-pan-x pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {children}
    </div>
  );
}

function IdentityFactCell({
  fact,
  recency,
  className = "",
}: {
  fact: { label: string; value: string; icon?: ReactNode };
  recency: { colorClass: string } | null;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 bg-[#FAF8F5] px-3.5 py-3 ${className}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {fact.icon ?? null}
      </span>
      <div className="flex min-w-0 flex-col justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
          {fact.label}
        </span>
        <span
          className={`mt-0.5 truncate text-[13px] font-bold leading-tight ${
            fact.label === "Last scan" && recency
              ? recency.colorClass
              : "text-[#1E1B31]"
          }`}
        >
          {fact.value}
        </span>
      </div>
    </div>
  );
}

/** One param tile - expands and shows a qualitative status on hover/tap; dims when a sibling is active. */
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
  const hoverLine = paramHoverLine(tile.key, tile.score);

  const inner = (
    <motion.div
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onClick={onActivate}
      animate={{
        opacity: isDimmed ? 0.55 : 1,
        scale: isActive ? 1.06 : 1,
      }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-0 flex h-full w-full flex-col items-center gap-1.5 rounded-xl border border-[#E4E6F0] bg-[#FAF8F5] px-1.5 py-2.5 text-center"
      style={isActive ? { zIndex: 10 } : undefined}
    >
      <CircleRing
        pct={hasScan ? tile.raw : 0}
        size={44}
        strokeWidth={4}
        color={hasScan ? tile.color : "#C8C4BC"}
      >
        <span
          className="text-sm font-extrabold leading-none tabular-nums"
          style={{ color: hasScan ? tile.color : "#9CA3AF" }}
        >
          {hasScan ? tile.score : "-"}
        </span>
      </CircleRing>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-[#6B7280]">
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
            <p className="text-[9.5px] font-semibold leading-snug text-[#1E1B31]">
              {tile.sublabel}
            </p>
            <p className="text-[9px] leading-snug text-[#6B7280]">{hoverLine}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );

  if (tile.href && hasScan) {
    return (
      <Link href={tile.href} className="block h-full w-full min-w-0">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function SkinDNACard({
  kaiSkinScore,
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
  // Scores are always shown as numbers - never gated behind clinic-visit unlock.
  const fromAnalysis =
    hasScan && analysisResults
      ? skinDnaParamsFromAnalysis(analysisResults)
      : null;
  const params: Record<SkinDNAParamKey, number> = {
    active_acne: paramsProp?.active_acne ?? fromAnalysis?.active_acne ?? 0,
    acne_scar: paramsProp?.acne_scar ?? fromAnalysis?.acne_scar ?? 0,
    pigmentation: paramsProp?.pigmentation ?? fromAnalysis?.pigmentation ?? 0,
    wrinkles: paramsProp?.wrinkles ?? fromAnalysis?.wrinkles ?? 0,
    under_eye: paramsProp?.under_eye ?? fromAnalysis?.under_eye ?? 0,
    sagging_volume:
      paramsProp?.sagging_volume ?? fromAnalysis?.sagging_volume ?? 0,
  };
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
  const improvement = lastScanImprovementCopy(
    weeklyDeltaScore,
    weeklyDeltaMeaningful,
    hasScan,
    scanCount
  );
  identityFacts.push({
    label: "Since last scan",
    value: improvement.value,
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
    })).sort((a, b) => b.raw - a.raw);

    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    strongest = {
      name: best.fullLabel,
      gradeLabel: `${scoreOutOfTen(best.raw)}/10`,
    };
    if (best.key !== worst.key) {
      needsFocus = {
        name: worst.fullLabel,
        gradeLabel: `${scoreOutOfTen(worst.raw)}/10`,
      };
    }
  }

  const recency = lastScanRecency(lastScanAt);

  const paramTiles: ParamTileData[] = PARAM_TILES.map((t) => {
    const raw = params[t.key];
    const metric = classifySkinParamMetric(raw);
    return {
      key: t.key,
      label: t.label,
      fullLabel: t.fullLabel,
      slugKey: t.slugKey,
      Icon: t.Icon,
      raw,
      score: scoreOutOfTen(raw),
      sublabel: toTitleCase(metric.sublabel),
      color: dnaRingColor(raw),
      href: scoreDetailHref(t.slugKey),
    };
  });

  const insightMessages = buildInsightMessages({
    strongest,
    needsFocus,
    streakCurrent,
    scanCount,
    lastScanAt,
    skinType,
    primaryConcern,
    overallTen: scoreOutOfTen(kaiSkinScore),
    improvementDetail: improvement.detail,
  });
  const headlineMessage = useRotatingMessage(insightMessages, 5000);
  const ringInsight = useRotatingMessage(
    insightMessages.length > 1
      ? [...insightMessages.slice(1), insightMessages[0]!]
      : insightMessages,
    6500
  );
  const [activeParam, setActiveParam] = useState<SkinDNAParamKey | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`relative z-0 overflow-hidden rounded-2xl border border-[#E4E6F0] bg-white shadow-sm ${className}`}
    >
      {/* 1. Header */}
      <div className="relative px-4 pb-3 pt-4 sm:px-5">
        <div className="relative flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
              Your Skin DNA
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={hasScan ? headlineMessage : "no-scan"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                className="font-headline mt-1 text-[15px] font-semibold leading-snug text-[#1E1B31] sm:text-base"
              >
                {hasScan
                  ? headlineMessage
                  : skinSummary?.trim() || "Unlock your skin potential"}
              </motion.p>
            </AnimatePresence>
          </div>

          <Link
            href={href}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#1E1B31] px-3 text-xs font-bold text-white transition hover:bg-[#242A5F]"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            View Report
          </Link>
        </div>
      </div>

      {/* 2. Identity strip — swipe on phone, row on desktop */}
      {identityFacts.length > 0 ? (
        <>
          <div className="lg:hidden">
            <SnapStrip className="px-4">
              {identityFacts.map((fact) => (
                <IdentityFactCell
                  key={fact.label}
                  fact={fact}
                  recency={recency}
                  className="w-[min(78%,16.5rem)] shrink-0 snap-start rounded-xl border border-[#E4E6F0]"
                />
              ))}
            </SnapStrip>
          </div>
          <div className="mx-5 hidden overflow-hidden rounded-xl border border-[#E4E6F0] bg-[#E4E6F0] lg:block">
            <div
              className={`grid gap-px ${
                identityFacts.length <= 4
                  ? "grid-cols-4"
                  : identityFacts.length === 5
                    ? "grid-cols-5"
                    : "grid-cols-3"
              }`}
            >
              {identityFacts.map((fact) => (
                <IdentityFactCell
                  key={fact.label}
                  fact={fact}
                  recency={recency}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* 3. Strongest / overall ring / needs focus */}
      {hasScan ? (
        <div className="mx-4 mt-3 rounded-2xl border border-[#E4E6F0] bg-[#FAF8F5] px-3 py-4 sm:mx-5 sm:px-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
          {strongest ? (
            <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#242A5F]/10 text-[#242A5F]">
                <Leaf className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#242A5F]">
                  Strongest
                </p>
                <p className="mt-0.5 truncate text-[13px] font-bold leading-snug text-[#1E1B31]">
                  {strongest.name}
                </p>
                <p className="text-[11px] font-medium text-[#6B7280]">
                  {strongest.gradeLabel}
                </p>
              </div>
            </div>
          ) : (
            <div />
          )}

          <Link
            href="/dashboard/score/overall"
            className="justify-self-center rounded-full outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#1E1B31]/30"
            aria-label="View overall skin score"
          >
          <CircleRing
            pct={kaiSkinScore}
            size={84}
            strokeWidth={6}
            color="#1E1B31"
            trackColor="#E4E6F0"
          >
            <div className="flex flex-col items-center justify-center">
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="text-2xl font-extrabold leading-none text-[#1E1B31]"
              >
                {scoreOutOfTen(kaiSkinScore)}
                <span className="text-xs font-bold opacity-60">/10</span>
              </motion.span>
              <span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-[#6B7280]">
                Overall
              </span>
            </div>
          </CircleRing>
          </Link>

          {needsFocus ? (
            <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-2.5">
              <div className="min-w-0 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#A05E6D]">
                  Needs focus
                </p>
                <p className="mt-0.5 truncate text-[13px] font-bold leading-snug text-[#1E1B31]">
                  {needsFocus.name}
                </p>
                <p className="text-[11px] font-medium text-[#6B7280]">
                  {needsFocus.gradeLabel}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DF9DA4]/25 text-[#A05E6D]">
                <Target className="h-4 w-4" aria-hidden />
              </span>
            </div>
          ) : (
            <div />
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={ringInsight}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35 }}
            className="mt-3 min-h-[2.75rem] border-t border-[#E4E6F0] pt-3 text-center text-[12px] font-medium leading-relaxed text-[#6B7280]"
          >
            {ringInsight}
          </motion.p>
        </AnimatePresence>
        </div>
      ) : null}

      {!hasScan ? (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-dashed border-[#E4E6F0] bg-[#FAF8F5] px-3.5 py-3 sm:mx-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0EAE2]">
            <svg className="h-4 w-4 text-[#1E1B31]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#1E1B31]">Complete your Skin DNA</p>
            <p className="text-xs text-[#6B7280]">Take a 2-min scan to unlock your score &amp; insights</p>
          </div>
        </div>
      ) : null}

      {/* 4. Parameter tiles — swipe on phone, full row on desktop */}
      <div
        className="mt-4 pb-4"
        onMouseLeave={() => setActiveParam(null)}
      >
        <SnapStrip className="px-4 lg:hidden">
          {paramTiles.map((tile) => (
            <div
              key={tile.key}
              className="w-[44%] shrink-0 snap-start sm:w-[32%]"
            >
              <InteractiveParamTile
                tile={tile}
                hasScan={hasScan}
                isActive={activeParam === tile.key}
                isDimmed={activeParam !== null && activeParam !== tile.key}
                onActivate={() => setActiveParam(tile.key)}
                onDeactivate={() =>
                  setActiveParam((cur) => (cur === tile.key ? null : cur))
                }
              />
            </div>
          ))}
        </SnapStrip>
        <div className="hidden grid-cols-6 gap-2 px-5 lg:grid">
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
      </div>
    </motion.div>
  );
}
