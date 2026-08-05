"use client";

import Link from "next/link";
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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
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
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-bold text-[#6B7280]">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        Steady
      </span>
    );
  }
  const up = weeklyDeltaScore > 0;
  const flat = weeklyDeltaScore === 0;
  if (flat) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-bold text-[#6B7280]">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        Steady
      </span>
    );
  }
  if (up) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        +{Math.abs(Math.round(weeklyDeltaScore))} this week
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
      <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
      −{Math.abs(Math.round(weeklyDeltaScore))} this week
    </span>
  );
}

export function SkinDNACard({
  patientName,
  profileImageUrl = null,
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
  const gradeText = kai.showLock
    ? `Grade ${kai.grade} · Locked`
    : `Grade ${kai.grade} · ${toTitleCase(kai.sublabel)}`;

  const identityFacts: { label: string; value: string }[] = [];
  const typeVal = skinType?.trim();
  if (typeVal)
    identityFacts.push({ label: "Skin Type", value: toTitleCase(typeVal) });
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

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-white shadow-md ${className}`}
    >
      {/* 1. Header */}
      <div className="flex items-start gap-3 px-4 pt-4 sm:gap-3.5 sm:px-5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-[#2C3E6B]/15 ring-offset-2 ring-offset-white">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#2C3E6B] text-sm font-bold tracking-wide text-white">
              {initialsFromName(displayName)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight text-[#18181b]">
                {displayName}
              </p>
              <span
                className="mt-1.5 inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                style={{
                  color: kai.color,
                  borderColor: `${kai.color}40`,
                  backgroundColor: `${kai.color}1A`,
                }}
              >
                {gradeText}
              </span>
              {skinSummary?.trim() &&
              !skinType?.trim() &&
              !primaryConcern?.trim() &&
              !fitzpatrick?.trim() ? (
                <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">
                  {skinSummary.trim()}
                </p>
              ) : null}
            </div>
            <TrendChip
              weeklyDeltaScore={weeklyDeltaScore}
              weeklyDeltaMeaningful={weeklyDeltaMeaningful}
            />
          </div>
        </div>
      </div>

      {/* 2. Identity strip */}
      {identityFacts.length > 0 ? (
        <div className="mx-4 mt-4 flex gap-0 overflow-x-auto rounded-xl border border-[#E5E7EB] bg-[#F8FAF8] scrollbar-hide sm:mx-5">
          {identityFacts.map((fact, i) => (
            <div
              key={fact.label}
              className={`flex min-w-[4.5rem] flex-1 flex-col px-3 py-2.5 ${
                i > 0 ? "border-l border-[#E5E7EB]" : ""
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                {fact.label}
              </span>
              <span className="mt-0.5 truncate text-[13px] font-bold text-[#18181b]">
                {fact.value}
              </span>
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
        <p className="mx-4 mt-3 text-sm font-medium text-[#6B7280] sm:mx-5">
          Take your first scan to complete your Skin DNA
        </p>
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
    </div>
  );
}
