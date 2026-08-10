"use client";

import { useMemo, useState } from "react";
import { ScanDetectionOverlay } from "@/components/dashboard/ScanDetectionOverlay";
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
  wrinkleLines?: WrinkleLine[];
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
  wrinkleLines = [],
  proxyRegions = [],
  parameterGrades,
}: FaceMapSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeConcern, setActiveConcern] = useState<ConcernChipId>("all");

  const photos = scanImages.length > 0 ? scanImages : [];
  const photo = photos[activeIndex] ?? photos[0];
  const pose = photo
    ? poseForLabel(photo.label, photo.poseId, activeIndex)
    : "centre";

  const showAcneProxy = pose === "centre";
  const showWrinkles = pose === "smiling";

  const chips = useMemo(
    () => [{ id: "all" as const, name: "All", grade: "", color: "mid" as const }, ...parameterGrades],
    [parameterGrades]
  );

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

      <div className="relative mb-[13px] aspect-[4/3] overflow-hidden rounded-[14px] bg-gradient-to-br from-[#DCE4DA] to-[#C6D2C8]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.label}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.14em] text-kai-navy/30">
            Capture with AI overlay
          </div>
        )}
        {photo ? (
          <ScanDetectionOverlay
            regions={showAcneProxy ? detectionRegions : []}
            wrinkleLines={showWrinkles ? wrinkleLines : []}
            proxyRegions={showAcneProxy ? proxyRegions : []}
            activeConcern={activeConcern}
          />
        ) : null}
        <p className="absolute bottom-[11px] left-3 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-kai-navy/60">
          {photo?.label ?? "Front profile"}
        </p>
        {photos.length > 1 ? (
          <div className="absolute bottom-[11px] left-1/2 flex -translate-x-1/2 gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => setActiveIndex(i)}
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
