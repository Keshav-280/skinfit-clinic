"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleDot,
  Droplets,
  FileText,
  Fingerprint,
  Minus,
  Palette,
  Waves,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
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

const FUN_SKIN_TYPE_LINE: Record<SkinTypeKey, string> = {
  oily: "Oily skin type",
  dry: "Dry skin type",
  combination: "Combination skin type",
  normal: "Normal skin type",
  sensitive: "Sensitive skin type",
};

/** Short header summary, e.g. "Oily skin type · focused on acne · up 4 points this week." */
function buildFunSkinLine(input: {
  skinType?: string | null;
  primaryConcern?: string | null;
  weeklyDeltaScore?: number;
  weeklyDeltaMeaningful?: boolean;
}): string | null {
  const key = resolveSkinTypeKey(input.skinType);
  if (!key) return null;

  const parts = [FUN_SKIN_TYPE_LINE[key]];
  const concern = input.primaryConcern?.trim().toLowerCase();
  if (concern) parts.push(`focused on ${concern}`);

  if (input.weeklyDeltaMeaningful && typeof input.weeklyDeltaScore === "number") {
    const delta = Math.round(input.weeklyDeltaScore);
    if (delta > 0) parts.push(`up ${Math.abs(delta)} points this week`);
    else if (delta < 0) parts.push(`down ${Math.abs(delta)} points this week`);
  }

  return parts.join(" · ");
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
  const funSkinLine = hasScan
    ? buildFunSkinLine({
        skinType,
        primaryConcern,
        weeklyDeltaScore,
        weeklyDeltaMeaningful,
      })
    : null;

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
  const ringPct = Math.max(0, Math.min(100, Math.round(kaiSkinScore)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`overflow-hidden rounded-2xl bg-white shadow-md transition-shadow duration-200 hover:shadow-lg ${className}`}
    >
      {/* 1. Header — gradient identity band */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#2C3E6B] to-[#1E3264] px-4 pb-4 pt-4 sm:px-5">
        <svg
          className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 opacity-[0.08]"
          viewBox="0 0 200 200"
          fill="none"
          aria-hidden
        >
          <circle cx="100" cy="100" r="99" stroke="white" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="70" stroke="white" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="41" stroke="white" strokeWidth="1.5" />
        </svg>

        <div className="relative flex items-start gap-3 sm:gap-3.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-white/30 ring-offset-2 ring-offset-[#2C3E6B]">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : resolvedGender ? (
              <AvatarIcon gender={resolvedGender} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/15 text-sm font-bold tracking-wide text-white">
                {initialsFromName(displayName)}
              </div>
            )}
          </div>

          {/* Name + summary */}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-lg font-bold leading-tight text-white">
              {displayName}
            </p>
            {skinSummary?.trim() &&
            !skinType?.trim() &&
            !primaryConcern?.trim() &&
            !fitzpatrick?.trim() ? (
              <p className="mt-0.5 truncate text-[12px] font-medium text-white/70">
                {skinSummary.trim()}
              </p>
            ) : null}
          </div>

          {/* Score widget — ring gauge */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <div
              className="relative flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: kai.showLock
                  ? "rgba(255,255,255,0.14)"
                  : `conic-gradient(${kai.color} ${ringPct}%, rgba(255,255,255,0.16) ${ringPct}%)`,
              }}
            >
              <div className="flex h-[46px] w-[46px] flex-col items-center justify-center rounded-full bg-[#243456]">
                <span
                  className="text-lg font-extrabold leading-none tabular-nums text-white"
                >
                  {kai.showLock ? kai.grade : Math.round(kaiSkinScore)}
                </span>
                <span className="mt-0.5 text-[7.5px] font-bold uppercase tracking-wide text-white/60">
                  {kai.showLock ? "Locked" : toTitleCase(kai.sublabel)}
                </span>
              </div>
            </div>
            <TrendChip
              weeklyDeltaScore={weeklyDeltaScore}
              weeklyDeltaMeaningful={weeklyDeltaMeaningful}
            />
          </div>
        </div>

        {funSkinLine ? (
          <p className="relative mt-2.5 text-[12.5px] font-medium leading-snug text-white/70">
            {funSkinLine}
          </p>
        ) : null}
      </div>

      {/* 2. Identity strip */}
      {identityFacts.length > 0 ? (
        <div className="mx-4 mt-4 flex gap-0 overflow-x-auto rounded-xl border border-[#E5E7EB] bg-[#F8F7F5] scrollbar-hide sm:mx-5">
          {identityFacts.map((fact, i) => (
            <div
              key={fact.label}
              className={`flex min-w-[4.5rem] flex-1 items-center gap-2 px-3 py-2.5 ${
                i > 0 ? "border-l border-[#E5E7EB]" : ""
              }`}
            >
              {fact.icon}
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  {fact.label}
                </span>
                <span className="mt-0.5 truncate text-[13px] font-bold text-[#18181b]">
                  {fact.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* 3. Strength / focus */}
      {hasScan && (strongest || needsFocus) ? (
        <div className="mx-4 mt-3 grid gap-2 sm:mx-5 sm:grid-cols-2">
          {strongest ? (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">
                Strongest
              </p>
              <p className="mt-0.5 text-[13px] font-bold text-[#18181b]">
                {strongest.name}
                <span className="font-semibold text-[#6B7280]">
                  {" "}
                  · {strongest.gradeLabel}
                </span>
              </p>
            </div>
          ) : null}
          {needsFocus ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/80">
                Needs focus
              </p>
              <p className="mt-0.5 text-[13px] font-bold text-[#18181b]">
                {needsFocus.name}
                <span className="font-semibold text-[#6B7280]">
                  {" "}
                  · {needsFocus.gradeLabel}
                </span>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!hasScan ? (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-dashed border-[#2C3E6B]/20 bg-[#F5F3EF] px-3.5 py-3 sm:mx-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2C3E6B]/10">
            <svg className="h-4 w-4 text-[#2C3E6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#2C3E6B]">Complete your Skin DNA</p>
            <p className="text-xs text-[#6B7280]">Take a 2-min scan to unlock your score &amp; insights</p>
          </div>
        </div>
      ) : null}

      {/* 4. Param tiles */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-5">
        {PARAM_TILES.map(({ key, label, slugKey, Icon }) => {
          const raw = params[key];
          const metric = classifySkinParamMetric(raw);
          const view = patientScoreView(raw, scoresUnlocked);
          const tileHref = scoreDetailHref(slugKey);
          const tint = hasScan ? `${metric.color}1A` : "#F3F4F6";
          const content = (
            <>
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: hasScan ? metric.color : "#9CA3AF" }}
                aria-hidden
              />
              <span
                className="text-base font-extrabold leading-none tabular-nums"
                style={{ color: hasScan ? metric.color : "#9CA3AF" }}
              >
                {hasScan ? view.grade : "—"}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-[#6B7280]">
                {label}
              </span>
            </>
          );
          const tileClass =
            "flex w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2.5 transition hover:opacity-80 sm:w-auto";
          const tileStyle = {
            borderColor: hasScan ? `${metric.color}33` : "#E5E7EB",
            backgroundColor: tint,
          } as const;

          if (tileHref && hasScan) {
            return (
              <Link
                key={key}
                href={tileHref}
                className={tileClass}
                style={tileStyle}
              >
                {content}
              </Link>
            );
          }
          return (
            <div key={key} className={tileClass} style={tileStyle}>
              {content}
            </div>
          );
        })}
      </div>

      {/* 5. Footer */}
      <div className="mt-3 border-t border-[#E5E7EB] px-4 py-3 sm:px-5">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2C3E6B] transition hover:underline"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          View full report
          <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Link>
      </div>
    </motion.div>
  );
}
