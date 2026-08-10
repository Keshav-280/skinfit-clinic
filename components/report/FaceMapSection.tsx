"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { ScanDetectionOverlay } from "@/components/dashboard/ScanDetectionOverlay";
import {
  legacyMaskTitleCropStyle,
  MASK_EXPORT_VERSION_TITLE_FREE,
  shouldCropLegacyMaskTitle,
} from "@/src/lib/maskImageCrop";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import type { KaiGradeTone } from "@/src/lib/kaiReportMapping";

export type FaceMapChip = {
  id: Exclude<ConcernChipId, "all">;
  name: string;
  grade: string;
  color: KaiGradeTone;
};

type FaceMapSectionProps = {
  scanImages: Array<{ url: string; label: string; poseId?: string }>;
  detectionRegions?: DetectionRegion[];
  /** Per-pose acne detections; falls back to `detectionRegions` (centre) when absent. */
  detectionRegionsByPose?: Record<string, DetectionRegion[]>;
  wrinkleLines?: WrinkleLine[];
  /** Model wrinkle segmentation heatmap (smiling pose) — only used when no vector lines. */
  wrinkleMaskUrl?: string | null;
  maskExportVersion?: number | null;
  proxyRegions?: ProxyRegion[];
  parameterGrades: FaceMapChip[];
};

const DOT: Record<KaiGradeTone, string> = {
  good: "bg-kai-good",
  mid: "bg-kai-mid",
  low: "bg-kai-low",
};

function poseForLabel(label: string, poseId: string | undefined, index: number): string {
  if (poseId) return poseId;
  const l = label.toLowerCase();
  if (l.includes("smil")) return "smiling";
  if (l.includes("left")) return "left";
  if (l.includes("right")) return "right";
  if (l.includes("eye") || l.includes("closed")) return "eyes_closed";
  if (l.includes("front") || l.includes("centr") || l.includes("primary")) {
    return "centre";
  }
  return index === 0 ? "centre" : "other";
}

export function FaceMapSection({
  scanImages,
  detectionRegions = [],
  detectionRegionsByPose,
  wrinkleLines = [],
  wrinkleMaskUrl,
  maskExportVersion,
  proxyRegions = [],
  parameterGrades,
}: FaceMapSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeConcern, setActiveConcern] = useState<ConcernChipId>("all");
  // Match the frame to the photo's real aspect ratio so object-cover never crops
  // (a crop shifts the percentage-based overlay markers off their targets).
  const [aspect, setAspect] = useState<number | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  const photos = scanImages.length > 0 ? scanImages : [];

  function selectIndex(i: number) {
    const n = photos.length;
    if (n === 0) return;
    const next = ((i % n) + n) % n;
    if (next === activeIndex) return;
    setActiveIndex(next);
    setAspect(null);
    setPhotoReady(false);
  }

  function onSwipeStart(e: PointerEvent<HTMLDivElement>) {
    swipeStartX.current = e.clientX;
  }
  function onSwipeEnd(e: PointerEvent<HTMLDivElement>) {
    const start = swipeStartX.current;
    swipeStartX.current = null;
    if (start == null || photos.length <= 1) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) < 40) return;
    selectIndex(activeIndex + (dx < 0 ? 1 : -1));
  }
  const photo = photos[activeIndex] ?? photos[0];
  const pose = photo
    ? poseForLabel(photo.label, photo.poseId, activeIndex)
    : "centre";

  // Acne shows on every pose (per-pose detections); proxy stays on the centre
  // pose and wrinkles on the smiling pose (landmark/mask models are frontal).
  const acneForPose =
    detectionRegionsByPose?.[pose] ??
    (pose === "centre" ? detectionRegions : []);
  const showProxy = pose === "centre";

  // Prefer SVG wrinkle lines (clean). Only fall back to the heatmap mask when
  // there are no lines AND the export is a title-free heatmap (v2) — never
  // screen-blend a face+heatmap composite (that causes double-exposure ghosting).
  const hasWrinkleLines = wrinkleLines.length > 0;
  const maskSrc = wrinkleMaskUrl?.trim()
    ? publicFileDisplayUrl(wrinkleMaskUrl) ?? wrinkleMaskUrl
    : "";
  const safeHeatmap =
    Boolean(maskSrc) &&
    (maskExportVersion === MASK_EXPORT_VERSION_TITLE_FREE ||
      maskExportVersion === 2);
  const showWrinkles = pose === "smiling" && hasWrinkleLines;
  const showWrinkleMask =
    pose === "smiling" && !hasWrinkleLines && safeHeatmap;
  const wrinkleMaskVisible =
    activeConcern === "all" || activeConcern === "wrinkles";

  const chips = useMemo(
    () => [{ id: "all" as const, name: "All", grade: "", color: "mid" as const }, ...parameterGrades],
    [parameterGrades]
  );

  const photoKey = photo
    ? `${activeIndex}:${photo.poseId ?? ""}:${photo.url}`
    : "empty";

  return (
    <section className="border-b border-kai-rule px-6 py-[26px]">
      <div className="mb-[15px] flex items-baseline justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
          Your face, mapped
        </h2>
        {photos.length > 1 ? (
          <span className="text-[11.5px] font-semibold text-kai-accent">
            All {photos.length} photos
          </span>
        ) : null}
      </div>

      <div
        className="relative mb-[13px] touch-pan-y select-none overflow-hidden rounded-[14px] bg-gradient-to-br from-[#DCE4DA] to-[#C6D2C8]"
        style={{ aspectRatio: aspect ?? 4 / 3 }}
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => {
          swipeStartX.current = null;
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photoKey}
            src={photo.url}
            alt={photo.label}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                setAspect(el.naturalWidth / el.naturalHeight);
              }
              setPhotoReady(true);
            }}
            onError={() => setPhotoReady(true)}
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
              photoReady ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.14em] text-kai-navy/30">
            Capture with AI overlay
          </div>
        )}
        {photo && showWrinkleMask ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`mask-${photoKey}`}
            src={maskSrc}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ease-out"
            style={{
              // Multiply keeps a true heatmap readable without stacking a second face.
              opacity: wrinkleMaskVisible ? 0.55 : 0,
              mixBlendMode: "multiply",
              ...(shouldCropLegacyMaskTitle(maskSrc, maskExportVersion)
                ? legacyMaskTitleCropStyle()
                : null),
            }}
          />
        ) : null}
        {photo && photoReady ? (
          <ScanDetectionOverlay
            regions={acneForPose}
            wrinkleLines={showWrinkles ? wrinkleLines : []}
            proxyRegions={showProxy ? proxyRegions : []}
            activeConcern={activeConcern}
          />
        ) : null}
        <p className="absolute bottom-[11px] left-3 z-[2] text-[9.5px] font-semibold uppercase tracking-[0.12em] text-kai-navy/60">
          {photo?.label ?? "Front profile"}
        </p>
        {photos.length > 1 ? (
          <div className="absolute bottom-[11px] left-1/2 z-[2] flex -translate-x-1/2 gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => selectIndex(i)}
                className={`block rounded-full transition-all ${
                  i === activeIndex
                    ? "h-1 w-3 rounded-sm bg-kai-navy/55"
                    : "h-1 w-1 bg-kai-navy/25"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-[7px] overflow-x-auto px-1 pb-0.5 scrollbar-hide">
        {chips.map((chip) => {
          const on = activeConcern === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveConcern(chip.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-[7px] text-[11px] font-semibold transition ${
                on
                  ? "border-kai-navy bg-kai-navy text-white"
                  : "border-kai-rule bg-white text-kai-ink-2"
              }`}
            >
              {chip.id !== "all" ? (
                <span className={`block h-1.5 w-1.5 rounded-full ${DOT[chip.color]}`} />
              ) : null}
              {chip.name}
              {chip.grade ? (
                <span className={`text-[10px] font-bold ${on ? "opacity-75" : "opacity-75"}`}>
                  {chip.grade}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
