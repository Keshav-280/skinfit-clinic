"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  spotAnnotatedUrl?: string | null;
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
  spotAnnotatedUrl,
  maskExportVersion,
  proxyRegions = [],
  parameterGrades,
}: FaceMapSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeConcern, setActiveConcern] = useState<ConcernChipId>("all");
  // Match frame to natural aspect; object-contain keeps % overlays aligned.
  const [aspect, setAspect] = useState<number | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  const photos = scanImages.length > 0 ? scanImages : [];
  const multi = photos.length > 1;

  const smilingIndex = useMemo(
    () =>
      photos.findIndex(
        (p, i) => poseForLabel(p.label, p.poseId, i) === "smiling"
      ),
    [photos]
  );
  const centreIndex = useMemo(
    () =>
      photos.findIndex(
        (p, i) => poseForLabel(p.label, p.poseId, i) === "centre"
      ),
    [photos]
  );

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
    if (start == null || !multi) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) < 40) return;
    selectIndex(activeIndex + (dx < 0 ? 1 : -1));
  }

  function selectConcern(id: ConcernChipId) {
    setActiveConcern(id);
    // Wrinkles are extracted on the smiling capture — jump there when available.
    if (id === "wrinkles" && smilingIndex >= 0) {
      selectIndex(smilingIndex);
      return;
    }
    // Scars / under-eye / acne proxies are centre-aligned.
    if (
      (id === "acne" ||
        id === "acne_scars" ||
        id === "under_eye" ||
        id === "pigmentation" ||
        id === "sagging_volume") &&
      centreIndex >= 0
    ) {
      selectIndex(centreIndex);
    }
  }

  const photo = photos[activeIndex] ?? photos[0];
  const pose = photo
    ? poseForLabel(photo.label, photo.poseId, activeIndex)
    : "centre";

  const acneForPose =
    detectionRegionsByPose?.[pose] ??
    (pose === "centre" ? detectionRegions : []);
  const showProxy = pose === "centre";

  const hasWrinkleLines = wrinkleLines.length > 0;
  const maskSrc = wrinkleMaskUrl?.trim()
    ? publicFileDisplayUrl(wrinkleMaskUrl) ?? wrinkleMaskUrl
    : "";
  const safeHeatmap =
    Boolean(maskSrc) &&
    (maskExportVersion === MASK_EXPORT_VERSION_TITLE_FREE ||
      maskExportVersion === 2);

  // Prefer smiling; if that pose isn't in the gallery, still show on centre.
  const wrinklePoseOk =
    pose === "smiling" || (pose === "centre" && smilingIndex < 0);
  // Heatmap from the model is higher quality than extracted polylines — prefer it.
  const showWrinkleMask = wrinklePoseOk && safeHeatmap;
  const showWrinkles = wrinklePoseOk && !showWrinkleMask && hasWrinkleLines;
  const wrinkleMaskVisible =
    activeConcern === "all" || activeConcern === "wrinkles";

  const chips = useMemo(
    () => [
      { id: "all" as const, name: "All", grade: "", color: "mid" as const },
      ...parameterGrades,
    ],
    [parameterGrades]
  );

  const photoKey = photo
    ? `${activeIndex}:${photo.poseId ?? ""}:${photo.url}`
    : "empty";

  return (
    <section className="border-b border-kai-rule px-6 py-[26px]">
      <div className="mb-[15px] flex items-baseline justify-between gap-3">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
          Your face, mapped
        </h2>
        {multi ? (
          <span className="text-[11.5px] font-semibold text-kai-accent">
            {activeIndex + 1} / {photos.length} · swipe or tap arrows
          </span>
        ) : (
          <span className="text-[10.5px] font-medium text-kai-ink-3">
            Front only — re-scan all angles for wrinkles
          </span>
        )}
      </div>

      <div
        className="relative mb-3 touch-pan-y select-none overflow-hidden rounded-[14px] bg-gradient-to-br from-[#DCE4DA] to-[#C6D2C8]"
        style={{ aspectRatio: aspect ?? 3 / 4 }}
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
            className={`absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-150 ${
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
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-300 ease-out"
            style={{
              opacity: wrinkleMaskVisible ? 0.75 : 0,
              mixBlendMode: "screen",
              filter: "contrast(2.2) brightness(0.85)",
              ...(shouldCropLegacyMaskTitle(maskSrc, maskExportVersion)
                ? legacyMaskTitleCropStyle()
                : null),
            }}
          />
        ) : null}
        {photo && photoReady && spotAnnotatedUrl?.trim() && pose === "centre" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicFileDisplayUrl(spotAnnotatedUrl) ?? spotAnnotatedUrl}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-300 ease-out"
            style={{
              opacity:
                activeConcern === "all" || activeConcern === "pigmentation"
                  ? 0.85
                  : 0,
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

        <p className="pointer-events-none absolute bottom-[11px] left-3 z-[2] rounded-md bg-black/35 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/95">
          {photo?.label ?? "Front profile"}
        </p>

        {multi ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => selectIndex(activeIndex - 1)}
              className="absolute left-2 top-1/2 z-[3] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/55"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => selectIndex(activeIndex + 1)}
              className="absolute right-2 top-1/2 z-[3] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/55"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <div className="absolute bottom-[11px] left-1/2 z-[2] flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => selectIndex(i)}
                  className={`block rounded-full transition-all ${
                    i === activeIndex
                      ? "h-1.5 w-4 rounded-sm bg-white"
                      : "h-1.5 w-1.5 bg-white/45"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {multi ? (
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide">
          {photos.map((p, i) => {
            const on = i === activeIndex;
            return (
              <button
                key={`${p.poseId ?? p.label}-${i}`}
                type="button"
                onClick={() => selectIndex(i)}
                className={`relative h-[58px] w-[46px] shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  on
                    ? "border-kai-navy ring-1 ring-kai-navy/30"
                    : "border-transparent opacity-80"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="-mx-1 flex gap-[7px] overflow-x-auto px-1 pb-0.5 scrollbar-hide">
        {chips.map((chip) => {
          const on = activeConcern === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => selectConcern(chip.id)}
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
                <span className="text-[10px] font-bold opacity-75">
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
