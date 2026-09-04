"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useCountUp } from "./useCountUp";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScanDetectionOverlay } from "@/components/dashboard/ScanDetectionOverlay";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import type { KaiGradeTone } from "@/src/lib/kaiReportMapping";
import { ReportGradeRing } from "./ReportGradeRing";

export type FaceMapChip = {
  id: Exclude<ConcernChipId, "all">;
  name: string;
  grade: string;
  color: KaiGradeTone;
};

export type FaceMapCover = {
  grade: string;
  position: number;
  title: string;
  badge: {
    label: string;
    type: "improving" | "flat" | "declining";
  };
  meta: { left: string; right: string };
};

type FaceMapSectionProps = {
  scanImages: Array<{ url: string; label: string; poseId?: string }>;
  detectionRegions?: DetectionRegion[];
  /** Per-pose acne detections; falls back to `detectionRegions` (centre) when absent. */
  detectionRegionsByPose?: Record<string, DetectionRegion[]>;
  wrinkleLines?: WrinkleLine[];
  /** Model wrinkle segmentation heatmap (front pose) - only used when no vector lines. */
  wrinkleMaskUrl?: string | null;
  spotAnnotatedUrl?: string | null;
  /** Photos already include v18 dashed-circle annotations - skip extra acne circles. */
  bakedSpotAnnotations?: boolean;
  maskExportVersion?: number | null;
  proxyRegions?: ProxyRegion[];
  parameterGrades: FaceMapChip[];
  /** Poster overlay: grade + title sit on the capture. */
  cover?: FaceMapCover;
  activeConcern?: ConcernChipId;
  onConcernChange?: (id: ConcernChipId) => void;
  /** History / back control, overlaid on the photo. */
  toolbar?: ReactNode;
  /** Report body - scrolls up over the sticky face. */
  children?: ReactNode;
};

const DOT: Record<KaiGradeTone, string> = {
  good: "bg-kai-good",
  mid: "bg-kai-mid",
  low: "bg-kai-low",
};

/** Size an image box so the full photo fits in the stage (letterbox) and overlay % coords stay true. */
function useCoverFrame(aspect: number | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const sw = el.clientWidth;
      const sh = el.clientHeight;
      if (sw < 2 || sh < 2) return;
      const ar = aspect && aspect > 0 ? aspect : 3 / 4;
      const stageAr = sw / sh;
      if (ar > stageAr) {
        setBox({ w: sw, h: sw / ar });
      } else {
        setBox({ h: sh, w: sh * ar });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  return { ref, box };
}

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
  bakedSpotAnnotations = false,
  maskExportVersion,
  proxyRegions = [],
  parameterGrades,
  cover,
  activeConcern: concernProp,
  onConcernChange,
  toolbar,
  children,
}: FaceMapSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [internalConcern, setInternalConcern] = useState<ConcernChipId>("all");
  const activeConcern = concernProp ?? internalConcern;
  const [phase, setPhase] = useState<"mapping" | "live">("mapping");
  const [sweepOn, setSweepOn] = useState(false);
  // Match frame to natural aspect; object-contain keeps % overlays aligned.
  const [aspect, setAspect] = useState<number | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const { ref: stageRef, box: coverBox } = useCoverFrame(aspect);

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
    pointerDownRef.current = true;
  }
  function onSwipeEnd(e: PointerEvent<HTMLDivElement>) {
    pointerDownRef.current = false;
    const start = swipeStartX.current;
    swipeStartX.current = null;
    if (start == null || !multi) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) < 40) return;
    selectIndex(activeIndex + (dx < 0 ? 1 : -1));
  }

  function selectConcern(id: ConcernChipId) {
    onConcernChange?.(id);
    if (concernProp == null) setInternalConcern(id);
    // Wrinkles are extracted on the front capture - jump there (or smiling on old scans).
    if (id === "wrinkles") {
      if (smilingIndex >= 0) selectIndex(smilingIndex);
      else if (centreIndex >= 0) selectIndex(centreIndex);
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

  const acneForPose = bakedSpotAnnotations
    ? []
    : detectionRegionsByPose?.[pose] ??
      (pose === "centre" ? detectionRegions : []);
  const showProxy = pose === "centre";

  // Patient wants raw capture photos here - no wrinkle heatmap or vector
  // overlay on this card, even when the model produced one.
  const showWrinkleMask = false;
  const showWrinkles = false;

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

  const markCount =
    acneForPose.length +
    (showProxy ? proxyRegions.length : 0) +
    (showWrinkles || showWrinkleMask ? 1 : 0);
  const liveCount = useCountUp(markCount, phase === "live");

  useEffect(() => {
    if (!photoReady) {
      setPhase("mapping");
      setSweepOn(false);
      return;
    }
    setSweepOn(true);
    const liveAt = window.setTimeout(() => setPhase("live"), 1200);
    const sweepOff = window.setTimeout(() => setSweepOn(false), 1350);
    return () => {
      window.clearTimeout(liveAt);
      window.clearTimeout(sweepOff);
    };
  }, [photoReady, photoKey]);

  useEffect(() => {
    if (!multi || activeConcern !== "all") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (pointerDownRef.current) return;
      if (document.visibilityState === "hidden") return;
      const n = photos.length;
      if (n <= 1) return;
      setActiveIndex((activeIndex + 1) % n);
      setAspect(null);
      setPhotoReady(false);
    }, 5000);
    return () => window.clearInterval(id);
  }, [multi, activeConcern, activeIndex, photos.length]);

  useEffect(() => {
    if (concernProp == null) return;
    if (concernProp === "wrinkles") {
      if (smilingIndex >= 0) selectIndex(smilingIndex);
      else if (centreIndex >= 0) selectIndex(centreIndex);
      return;
    }
    if (
      (concernProp === "acne" ||
        concernProp === "acne_scars" ||
        concernProp === "under_eye" ||
        concernProp === "pigmentation" ||
        concernProp === "sagging_volume") &&
      centreIndex >= 0
    ) {
      selectIndex(centreIndex);
    }
    // selectIndex is local; jump only when the parent concern changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concernProp]);

  const watching =
    parameterGrades.find((c) => c.id === activeConcern)?.name ?? "All markers";

  const coverStyle =
    coverBox.w > 0
      ? { width: coverBox.w, height: coverBox.h }
      : { width: "100%", height: "100%" };

  return (
    <div>
      <div
        className="sticky top-[3.6rem] z-0 h-[calc(100dvh-3.6rem-5.85rem)] w-full sm:top-[4.15rem] sm:h-[calc(100dvh-4.15rem-5.85rem)] md:top-[4.5rem] md:h-[calc(100dvh-4.5rem)]"
      >
        <div
          ref={stageRef}
          className="relative h-full w-full touch-pan-y select-none overflow-hidden bg-[#1E1B31]"
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={() => {
            swipeStartX.current = null;
            pointerDownRef.current = false;
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={coverStyle}
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
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${
                  photoReady ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Capture with AI overlay
              </div>
            )}
            {photo &&
            photoReady &&
            !bakedSpotAnnotations &&
            spotAnnotatedUrl?.trim() &&
            pose === "centre" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={publicFileDisplayUrl(spotAnnotatedUrl) ?? spotAnnotatedUrl}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-out"
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
                live={Boolean(cover)}
              />
            ) : null}
          </div>

          {cover && sweepOn ? (
            <div
              data-pdf-screen-only
              className="report-scan-sweep pointer-events-none absolute inset-x-0 z-[2] h-16"
              aria-hidden
            />
          ) : null}

          {toolbar ? (
            <div className="absolute left-3 top-3 z-[4]" data-pdf-screen-only>
              {toolbar}
            </div>
          ) : null}

          {cover ? (
            <div className="pointer-events-none absolute inset-0 z-[2]">
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div
                className={`absolute inset-x-0 top-0 flex items-start justify-between px-3.5 ${
                  toolbar ? "pt-12" : "pt-3"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      phase === "live"
                        ? "bg-[#5EE0A0] report-live-dot-on"
                        : "bg-[#7EE0F2] report-live-dot"
                    }`}
                  />
                  {phase === "live"
                    ? `Live · ${liveCount} mark${liveCount === 1 ? "" : "s"}`
                    : "Mapping…"}
                </span>
                {toolbar ? (
                  <span />
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/80">
                    {cover.meta.right}
                  </span>
                )}
              </div>
              {toolbar ? (
                <span className="absolute right-3.5 top-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/80">
                  {cover.meta.right}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 px-3.5 pb-8 pt-10">
                <div className="flex items-center gap-3">
                  <ReportGradeRing
                    grade={cover.grade}
                    position={cover.position}
                    size={72}
                    variant="glass"
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.04em] ${
                        cover.badge.type === "improving"
                          ? "bg-[#4E9B72]/80 text-white"
                          : cover.badge.type === "declining"
                            ? "bg-[#C4694F]/80 text-white"
                            : "bg-white/20 text-white"
                      }`}
                    >
                      {cover.badge.label}
                    </span>
                    <p
                      className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-white"
                      style={{ textShadow: "0 2px 12px rgba(0,0,0,0.65)" }}
                    >
                      {cover.title}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="pointer-events-none absolute bottom-4 left-3 z-[2] rounded-md bg-black/35 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/95">
              {photo?.label ?? "Front profile"}
            </p>
          )}

          {cover ? (
            <p
              className={`pointer-events-none absolute right-3.5 z-[2] rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/90 ${
                toolbar ? "top-[4.75rem]" : "top-9"
              }`}
            >
              {photo?.label ?? "Front"}
            </p>
          ) : null}

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
              <div
                className={`absolute left-1/2 z-[3] flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1 ${
                  toolbar ? "top-[4.75rem]" : "top-[42px]"
                }`}
              >
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

          <div
            className="pointer-events-none absolute inset-x-0 bottom-2 z-[4] flex justify-center"
            aria-hidden
          >
            <span className="h-1 w-10 rounded-full bg-white/50" />
          </div>
        </div>
      </div>

      <div className="relative z-10 rounded-t-[28px] bg-[#FAF8F5] px-4 pb-24 pt-4 shadow-[0_-18px_40px_-20px_rgba(30,27,49,0.35)] md:pb-10">
        <div className="mx-auto w-full max-w-[430px] sm:max-w-[460px]">
          {multi ? (
            <div className="-mx-0.5 mb-2.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 scrollbar-hide">
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

          <div className="-mx-0.5 flex gap-[7px] overflow-x-auto px-0.5 pb-1 scrollbar-hide">
            {chips.map((chip) => {
              const on = activeConcern === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => selectConcern(chip.id)}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-[7px] text-[11px] font-semibold transition ${
                    on
                      ? "border-[#1E1B31] bg-[#1E1B31] text-white"
                      : "border-transparent bg-white text-[#5B6478] ring-1 ring-[#E4E6F0]"
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
          {cover ? (
            <p className="px-1 pb-3 pt-1 text-[11px] font-medium text-[#8B93A4]">
              Watching{" "}
              <span className="font-semibold text-[#1E1B31]">{watching}</span>
              {phase === "live" ? ` · ${liveCount} live` : " · mapping"}
            </p>
          ) : null}

          {children ? (
            <div className="flex flex-col gap-3">{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
