"use client";

import Link from "next/link";
import { ChevronRight, User } from "lucide-react";
import {
  classifySkinParamMetric,
  patientKaiScoreView,
  patientScoreView,
} from "@/src/lib/clarityGrade";
import { resolveScanDisplayScores } from "@/src/lib/resolveScanDisplayScores";

export type SkinDNAParamKey =
  | "acne"
  | "pigmentation"
  | "wrinkles"
  | "hydration"
  | "texture";

const PARAM_TILES: { key: SkinDNAParamKey; label: string }[] = [
  { key: "acne", label: "Acne" },
  { key: "pigmentation", label: "Pigmentation" },
  { key: "wrinkles", label: "Wrinkles" },
  { key: "hydration", label: "Hydration" },
  { key: "texture", label: "Texture" },
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

export type SkinDNACardProps = {
  patientName: string;
  profileImageUrl?: string | null;
  kaiSkinScore: number;
  scoresUnlocked: boolean;
  /** Latest scan `analysisResults` — used when `params` is omitted. */
  analysisResults?: unknown;
  /** Optional pre-extracted raw param scores (0–100). */
  params?: Partial<Record<SkinDNAParamKey, number>>;
  href?: string;
  className?: string;
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
  href = "/dashboard/history",
  className = "",
}: SkinDNACardProps) {
  const kai = patientKaiScoreView(kaiSkinScore, scoresUnlocked);
  const fromAnalysis = analysisResults
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

  return (
    <Link
      href={href}
      className={`group block overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_8px_28px_-8px_rgba(44,62,107,0.12)] transition hover:border-[#2C3E6B]/25 hover:shadow-[0_12px_32px_-10px_rgba(44,62,107,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B] ${className}`}
      aria-label="Personal Skin DNA — view full report"
    >
      <div className="bg-gradient-to-br from-[#F2F9F2] via-white to-[#F2F9F2] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3.5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#2C3E6B]/10 shadow-sm sm:h-16 sm:w-16">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[#2C3E6B] text-white">
                <User className="h-5 w-5 opacity-90" aria-hidden />
                <span className="text-[10px] font-bold tracking-wide">
                  {initialsFromName(displayName)}
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2C3E6B]/55">
              Personal Skin DNA
            </p>
            <p className="mt-0.5 truncate text-lg font-extrabold text-[#2C3E6B] sm:text-xl">
              {displayName}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-bold"
                style={{
                  color: kai.color,
                  borderColor: `${kai.color}55`,
                  backgroundColor: `${kai.color}14`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: kai.color }}
                  aria-hidden
                />
                kAI {kai.kaiPrimary}
                {kai.showLock ? (
                  <span className="font-semibold text-[#6B7280]">· locked</span>
                ) : null}
              </span>
              <span className="text-[12px] font-medium text-[#6B7280]">
                {kai.sublabel}
              </span>
            </div>
          </div>

          <ChevronRight
            className="h-5 w-5 shrink-0 text-[#2C3E6B]/40 transition group-hover:translate-x-0.5 group-hover:text-[#2C3E6B]"
            aria-hidden
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {PARAM_TILES.map(({ key, label }) => {
            const raw = params[key];
            const metric = classifySkinParamMetric(raw);
            const view = patientScoreView(raw, scoresUnlocked);
            return (
              <div
                key={key}
                className="rounded-xl border border-[#E5E7EB] bg-white/90 px-2.5 py-3 text-center shadow-sm"
              >
                <div className="mb-1.5 flex items-center justify-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: metric.color }}
                    aria-hidden
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
                    {label}
                  </span>
                </div>
                <p
                  className="text-xl font-extrabold tabular-nums leading-none"
                  style={{ color: metric.color }}
                >
                  {view.label}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-[#9CA3AF]">
                  {metric.sublabel}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-[#2C3E6B] px-4 py-3 text-white transition group-hover:bg-[#243456]">
          <span className="text-[14px] font-bold">View Full Report</span>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
