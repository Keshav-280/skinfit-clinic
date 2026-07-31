"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  CircleDot,
  Droplets,
  Fingerprint,
  Palette,
  Waves,
} from "lucide-react";
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
  slugKey: string;
  Icon: LucideIcon;
}[] = [
  { key: "acne", label: "Acne", slugKey: "acne", Icon: CircleDot },
  {
    key: "pigmentation",
    label: "Pigment",
    slugKey: "pigmentation",
    Icon: Palette,
  },
  { key: "wrinkles", label: "Wrinkles", slugKey: "wrinkles", Icon: Waves },
  { key: "hydration", label: "Hydration", slugKey: "hydration", Icon: Droplets },
  { key: "texture", label: "Texture", slugKey: "texture", Icon: Fingerprint },
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

function fitzpatrickToneLabel(fitz: string | null | undefined): string | null {
  const t = fitz?.trim().toUpperCase();
  if (!t) return null;
  if (t === "I" || t === "II" || t === "1" || t === "2") return "Light tone";
  if (t === "III" || t === "3") return "Medium tone";
  if (t === "IV" || t === "4") return "Medium-deep tone";
  if (t === "V" || t === "VI" || t === "5" || t === "6") return "Deep tone";
  return `Type ${t}`;
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
  if (skin) parts.push(skin);
  const concern = input.primaryConcern?.trim();
  if (concern) parts.push(formatConcernLabel(concern));
  const tone = fitzpatrickToneLabel(input.fitzpatrick);
  if (tone) parts.push(tone);
  return parts.length > 0 ? parts.join(" · ") : null;
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
  /** e.g. "Oily · Acne-prone · Medium tone" */
  skinSummary?: string | null;
  href?: string;
  className?: string;
  /** When false, param tiles render as zeros / locked without requiring a scan. */
  hasScan?: boolean;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function SkinDNACard({
  patientName,
  profileImageUrl = null,
  kaiSkinScore,
  scoresUnlocked,
  analysisResults,
  params: paramsProp,
  skinSummary = null,
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
  const summaryLine = skinSummary?.trim() || "Complete your profile";
  const gradeText = kai.showLock
    ? `Grade ${kai.grade} · locked`
    : `Grade ${kai.grade} · ${kai.sublabel}`;

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-white shadow-md ${className}`}
    >
      <div className="flex max-h-[180px] flex-col">
        {/* Top: avatar · identity · report link */}
        <div className="flex items-center gap-3 px-4 pb-2.5 pt-3.5 sm:gap-3.5 sm:px-5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-[#2C3E6B]/15 ring-offset-2 ring-offset-white">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#2C3E6B] text-sm font-bold tracking-wide text-white">
                {initialsFromName(displayName)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-tight text-[#18181b]">
              {displayName}
            </p>
            <span
              className="mt-1 inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
              style={{
                color: kai.color,
                borderColor: `${kai.color}40`,
                backgroundColor: `${kai.color}1A`,
              }}
            >
              {gradeText}
            </span>
            <p className="mt-1 truncate text-[12px] font-medium text-[#6B7280]">
              {summaryLine}
            </p>
          </div>

          <Link
            href={href}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F8FAFC] text-[#2C3E6B] transition hover:bg-[#F2F9F2] hover:opacity-80"
            aria-label="View full report"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {/* Bottom: mini grade tiles */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3.5 pt-1 scrollbar-hide sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-5">
          {PARAM_TILES.map(({ key, label, slugKey, Icon }) => {
            const raw = params[key];
            const metric = classifySkinParamMetric(raw);
            const view = patientScoreView(raw, scoresUnlocked);
            const tileHref = scoreDetailHref(slugKey);
            const tint = `${metric.color}1A`;
            const content = (
              <>
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: metric.color }}
                  aria-hidden
                />
                <span
                  className="text-base font-extrabold leading-none tabular-nums"
                  style={{ color: metric.color }}
                >
                  {hasScan ? view.grade : "—"}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  {label}
                </span>
              </>
            );
            const tileClass =
              "flex w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition hover:opacity-80 sm:w-auto";
            const tileStyle = {
              borderColor: `${metric.color}33`,
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
      </div>
    </div>
  );
}
