"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Download, Minus } from "lucide-react";
import { patientKaiScoreView, patientScoreView } from "@/src/lib/clarityGrade";
import { patientScanImageDisplayUrl } from "@/src/lib/patientScanImagePath";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";
import { trackerParamRowDisplayDelta } from "@/src/lib/trackerDisplayDelta";
import type { ReportMetrics, ReportRegion } from "./scanReportTypes";
import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import {
  ConcernChips,
  type ConcernChipId,
  type ConcernChipItem,
} from "./ConcernChips";
import { ScanFaceOverlay } from "./ScanMaskAnnotations";
import { ScanDetectionOverlay } from "./ScanDetectionOverlay";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import {
  legacyMaskTitleCropStyle,
  shouldCropLegacyMaskTitle,
} from "@/src/lib/maskImageCrop";

const CONCERN_META: Array<{
  id: Exclude<ConcernChipId, "all">;
  label: string;
  /** Legacy 0–100 metric fallback when no tracker param row is present. */
  metricKey?: keyof ReportMetrics;
  /** RAG kAI param keys (primary score source, via tracker.paramRows). */
  paramKeys: string[];
}> = [
  {
    id: "acne",
    label: "Active Acne",
    metricKey: "acne",
    paramKeys: ["active_acne", "acne"],
  },
  {
    id: "acne_scars",
    label: "Acne Scars",
    paramKeys: ["acne_scar", "acne_scars"],
  },
  {
    id: "pigmentation",
    label: "Pigmentation",
    metricKey: "pigmentation",
    paramKeys: ["pigmentation", "pigmentation_model"],
  },
  {
    id: "wrinkles",
    label: "Wrinkles",
    metricKey: "wrinkles",
    paramKeys: ["wrinkles", "wrinkle_severity"],
  },
  {
    id: "under_eye",
    label: "Under Eye",
    paramKeys: ["under_eye"],
  },
  {
    id: "sagging_volume",
    label: "Sagging & Volume",
    paramKeys: ["sagging_volume"],
  },
];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 6.045L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ReportFaceImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const displaySrc = patientScanImageDisplayUrl(src);
  const isInline =
    src.trim().startsWith("data:") || src.trim().startsWith("blob:");
  const [loaded, setLoaded] = useState(isInline);
  return (
    <>
      {!isInline && !loaded ? (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" aria-hidden />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt={alt}
        className={`h-full w-full object-cover object-center transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        draggable={false}
      />
    </>
  );
}

/** Legacy wrinkle heatmap when vector polylines are not available. */
function WrinkleMaskFallback({
  src,
  visible,
  maskExportVersion,
}: {
  src: string;
  visible: boolean;
  maskExportVersion?: number | null;
}) {
  const displaySrc = publicFileDisplayUrl(src) ?? src;
  const cropLegacyTitle = shouldCropLegacyMaskTitle(
    displaySrc,
    maskExportVersion
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt=""
      aria-hidden={!visible}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ease-out"
      style={{
        opacity: visible ? 0.72 : 0,
        mixBlendMode: "screen",
        ...(cropLegacyTitle ? legacyMaskTitleCropStyle() : null),
      }}
    />
  );
}

function insightLine(
  id: Exclude<ConcernChipId, "all">,
  score: number | null,
  scoresUnlocked: boolean,
  tracker: PatientTrackerReport | null | undefined
): string {
  const row = tracker?.paramRows?.find((r) =>
    CONCERN_META.find((m) => m.id === id)?.paramKeys.includes(r.key)
  );
  const view =
    score != null ? patientScoreView(score, scoresUnlocked) : null;
  const delta =
    row && tracker
      ? trackerParamRowDisplayDelta(tracker, row)
      : row?.delta ?? null;

  if (view && delta != null && Math.abs(delta) >= 1) {
    const dir = delta > 0 ? "up" : "down";
    return scoresUnlocked
      ? `${view.label} this scan — ${dir === "up" ? "+" : ""}${delta} vs last. Keep focusing here.`
      : `Grade ${view.label} — trending ${dir === "up" ? "better" : "softer"} vs last scan.`;
  }
  if (view) {
    const label = CONCERN_META.find((m) => m.id === id)?.label ?? id;
    return `${view.sublabel}: ${label} is a priority focus this week.`;
  }
  return "Tap to focus this concern on your scan photo.";
}

export type ScanViewerProps = {
  imageUrl: string;
  faceCaptureGallery?: Array<{ label: string; imageUrl: string }>;
  metrics: ReportMetrics;
  regions: ReportRegion[];
  /** Interactive dashed circles from acne-detector (newer scans). */
  detectionRegions?: DetectionRegion[];
  /** Skeleton wrinkle polylines (newer scans). */
  wrinkleLines?: WrinkleLine[];
  /** Landmark proxy zones for pigmentation / scars / under-eye / sagging. */
  proxyRegions?: ProxyRegion[];
  wrinkleMaskUrl?: string;
  acneMaskUrl?: string;
  maskExportVersion?: number | null;
  spatialOutputs?: ScanSpatialOutputs;
  scoresUnlocked?: boolean;
  scanId?: number;
  tracker?: PatientTrackerReport | null;
  reportMode?: "navigate" | "scroll";
  /** Called when reportMode is scroll and user opens the full report. */
  onRequestFullReport?: () => void;
  onDownloadPdf?: () => void;
  pdfLoading?: boolean;
};

export function ScanViewer({
  imageUrl,
  faceCaptureGallery,
  metrics,
  regions,
  detectionRegions,
  wrinkleLines,
  proxyRegions,
  wrinkleMaskUrl,
  acneMaskUrl,
  maskExportVersion,
  spatialOutputs,
  scoresUnlocked = false,
  scanId,
  tracker,
  reportMode = "scroll",
  onRequestFullReport,
  onDownloadPdf,
  pdfLoading = false,
}: ScanViewerProps) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeConcern, setActiveConcern] = useState<ConcernChipId>("all");

  const photos = useMemo(() => {
    if (faceCaptureGallery && faceCaptureGallery.length > 0) {
      return faceCaptureGallery;
    }
    if (imageUrl?.trim()) {
      return [{ label: "Front", imageUrl }];
    }
    return [];
  }, [faceCaptureGallery, imageUrl]);

  const overall = Math.round(metrics.overall_score);
  const kaiView = patientKaiScoreView(overall, scoresUnlocked);
  const weeklyDelta = tracker?.scores.weeklyDelta ?? null;

  const chips: ConcernChipItem[] = useMemo(() => {
    return CONCERN_META.flatMap((meta) => {
      // Primary source: RAG kAI param score (0–100) from the tracker report.
      const row = tracker?.paramRows?.find((r) =>
        meta.paramKeys.includes(r.key)
      );
      let raw: number | null =
        row && typeof row.value === "number" ? row.value : null;
      // Fallback: legacy 0–100 metric (only for params that have one).
      if (raw == null && meta.metricKey) {
        const m = metrics[meta.metricKey];
        if (typeof m === "number") raw = m;
      }
      if (raw == null) return [];
      const view = patientScoreView(raw, scoresUnlocked);
      return [
        {
          id: meta.id,
          label: meta.label,
          score: raw,
          scoreLabel: view.label,
        },
      ];
    });
  }, [metrics, scoresUnlocked, tracker]);

  const selectedMeta =
    activeConcern === "all"
      ? null
      : CONCERN_META.find((m) => m.id === activeConcern) ?? null;

  const selectedChip =
    selectedMeta != null
      ? chips.find((c) => c.id === selectedMeta.id) ?? null
      : null;

  const selectedRow =
    selectedMeta && tracker
      ? tracker.paramRows.find((r) =>
          selectedMeta.paramKeys.includes(r.key)
        )
      : null;

  const selectedDelta =
    selectedRow && tracker
      ? trackerParamRowDisplayDelta(tracker, selectedRow)
      : selectedRow?.delta ?? null;

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || photos.length === 0) return;
    const w = el.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / w);
    setActiveIndex(Math.max(0, Math.min(photos.length - 1, idx)));
  }, [photos.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  function handleViewFullReport() {
    if (reportMode === "navigate" && typeof scanId === "number" && scanId > 0) {
      router.push(`/dashboard/history/${scanId}`);
      return;
    }
    onRequestFullReport?.();
  }

  function handleWhatsAppShare() {
    const scoreBit = scoresUnlocked
      ? `kAI score ${kaiView.kaiPrimary}`
      : `kAI grade ${kaiView.kaiPrimary}`;
    const text = `My SkinFit Wellness scan — ${scoreBit}. Track your skin with AI at SkinFit.`;
    const url =
      typeof scanId === "number" && scanId > 0 && typeof window !== "undefined"
        ? `${window.location.origin}/dashboard/history/${scanId}`
        : typeof window !== "undefined"
          ? window.location.href
          : "";
    const share = url ? `${text}\n${url}` : text;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(share)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const hasDetectionRegions = (detectionRegions?.length ?? 0) > 0;
  const hasWrinkleLines = (wrinkleLines?.length ?? 0) > 0;
  const hasProxyRegions = (proxyRegions?.length ?? 0) > 0;
  const useVectorOverlay =
    hasDetectionRegions || hasWrinkleLines || hasProxyRegions;
  const showWrinkleMaskFallback =
    useVectorOverlay && !hasWrinkleLines && Boolean(wrinkleMaskUrl?.trim());
  const wrinkleMaskVisible =
    activeConcern === "all" || activeConcern === "wrinkles";

  /** Map gallery labels to capture step ids for pose-scoped overlays. */
  function poseIdForPhoto(label: string, index: number): string {
    const l = label.toLowerCase();
    if (l.includes("smil")) return "smiling";
    if (l.includes("left")) return "left";
    if (l.includes("right")) return "right";
    if (l.includes("eye") || l.includes("closed")) return "eyes_closed";
    if (l.includes("front") || l.includes("centr") || l.includes("primary")) {
      return "centre";
    }
    // Single-photo reports / unknown labels → treat as centre so acne/proxy still show.
    if (photos.length <= 1) return "centre";
    return index === 0 ? "centre" : "other";
  }

  return (
    <div className="w-full bg-[#F2F9F2]">
      <div className="relative bg-[#0F172A]">
        <div
          ref={scrollerRef}
          className="flex h-[65vh] min-h-[320px] max-h-[720px] snap-x snap-mandatory overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.length === 0 ? (
            <div className="flex h-full min-w-full snap-center items-center justify-center text-sm text-white/60">
              No scan photos
            </div>
          ) : (
            photos.map((photo, i) => {
              const pose = poseIdForPhoto(photo.label, i);
              const showAcneProxy = pose === "centre";
              const showWrinkles = pose === "smiling";
              const showWrinkleFallback =
                showWrinkleMaskFallback && showWrinkles;
              const poseHasOverlay =
                (showAcneProxy && (hasDetectionRegions || hasProxyRegions)) ||
                (showWrinkles && (hasWrinkleLines || showWrinkleFallback));

              return (
              <div
                key={`${photo.label}-${i}`}
                className="relative h-full min-w-full shrink-0 snap-center"
              >
                <ReportFaceImage src={photo.imageUrl} alt={photo.label} />
                {useVectorOverlay && poseHasOverlay ? (
                  <>
                    {showWrinkleFallback ? (
                      <WrinkleMaskFallback
                        src={wrinkleMaskUrl!}
                        visible={wrinkleMaskVisible}
                        maskExportVersion={maskExportVersion}
                      />
                    ) : null}
                    <ScanDetectionOverlay
                      regions={
                        showAcneProxy ? detectionRegions ?? [] : []
                      }
                      wrinkleLines={
                        showWrinkles ? wrinkleLines ?? [] : []
                      }
                      proxyRegions={
                        showAcneProxy ? proxyRegions ?? [] : []
                      }
                      activeConcern={activeConcern}
                    />
                  </>
                ) : !useVectorOverlay ? (
                  <ScanFaceOverlay
                    imageUrl={photo.imageUrl}
                    wrinkleMaskUrl={
                      showWrinkles ? wrinkleMaskUrl : undefined
                    }
                    acneMaskUrl={showAcneProxy ? acneMaskUrl : undefined}
                    maskExportVersion={maskExportVersion}
                    spatialOutputs={spatialOutputs}
                    regions={regions}
                    activeConcern={activeConcern}
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
                <p className="absolute bottom-10 left-4 text-xs font-medium text-white/80">
                  {photo.label}
                </p>
              </div>
              );
            })
          )}
        </div>

        {/* kAI badge */}
        <div className="absolute right-3 top-3 z-10 flex flex-col items-center justify-center rounded-full border border-white/30 bg-white/20 px-3 py-2.5 shadow-lg backdrop-blur-md">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/80">
            kAI
          </p>
          <p className="text-lg font-extrabold tabular-nums leading-none text-white">
            {kaiView.kaiPrimary}
          </p>
          {weeklyDelta != null && Math.abs(weeklyDelta) >= 1 ? (
            <span className="mt-1 inline-flex items-center text-white/90">
              {weeklyDelta > 0 ? (
                <ArrowUp className="h-3.5 w-3.5" aria-label="Improved" />
              ) : weeklyDelta < 0 ? (
                <ArrowDown className="h-3.5 w-3.5" aria-label="Softer" />
              ) : (
                <Minus className="h-3.5 w-3.5" aria-label="Steady" />
              )}
            </span>
          ) : null}
        </div>

        {/* Dots */}
        {photos.length > 1 ? (
          <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (!el) return;
                  el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIndex
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-0 pb-6 pt-4">
        <ConcernChips
          items={chips}
          activeId={activeConcern}
          onSelect={setActiveConcern}
        />

        {hasProxyRegions ? (
          <p className="px-4 text-center text-[10px] italic text-zinc-400">
            Zone highlights are AI-estimated based on your skin analysis scores
          </p>
        ) : null}

        <div className="min-h-[4.5rem] px-4">
          <AnimatePresence mode="wait">
            {selectedChip && selectedMeta ? (
              <motion.div
                key={selectedChip.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-[rgba(44,62,107,0.12)] bg-white px-4 py-3.5 shadow-[0_12px_28px_-18px_rgba(44,62,107,0.35)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-bold text-[#2C3E6B]">
                    {selectedChip.label}
                  </p>
                  <p className="text-sm font-extrabold tabular-nums text-[#1E3264]">
                    {selectedChip.scoreLabel}
                    {selectedDelta != null && scoresUnlocked ? (
                      <span className="ml-1.5 text-xs font-semibold text-[#6B7280]">
                        {selectedDelta > 0 ? "+" : ""}
                        {selectedDelta}
                      </span>
                    ) : null}
                  </p>
                </div>
                <p className="mt-1.5 text-sm leading-snug text-zinc-600">
                  {insightLine(
                    selectedMeta.id,
                    selectedChip.score,
                    scoresUnlocked,
                    tracker
                  )}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="space-y-2.5 px-4">
          <button
            type="button"
            onClick={handleViewFullReport}
            className="w-full rounded-xl bg-[#2C3E6B] py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_-14px_rgba(44,62,107,0.55)] transition hover:bg-[#354A7A]"
          >
            View Full Report
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onDownloadPdf?.()}
              disabled={pdfLoading || !onDownloadPdf}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(44,62,107,0.25)] bg-white py-3 text-sm font-semibold text-[#2C3E6B] transition hover:bg-white/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {pdfLoading ? "…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe57]"
            >
              <WhatsAppIcon className="h-4 w-4" />
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
