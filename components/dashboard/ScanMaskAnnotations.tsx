"use client";

import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import { MASK_MATPLOTLIB_TITLE_CROP_RATIO } from "@/src/lib/maskImageCrop";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import { DOT_MARKER_LEGEND } from "@/src/lib/scanMaskLabels";
import type { ReportRegion } from "./scanReportTypes";

function regionMarkerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  return "#6b7280";
}

function MaskPanel({
  src,
  alt,
  caption,
  fallbackSrc,
}: {
  src: string;
  alt: string;
  caption: string;
  fallbackSrc?: string;
}) {
  const crop = MASK_MATPLOTLIB_TITLE_CROP_RATIO;
  const displaySrc = publicFileDisplayUrl(src) ?? src;
  const fallback = fallbackSrc ? publicFileDisplayUrl(fallbackSrc) ?? fallbackSrc : "";
  return (
    <figure className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80">
      <div
        className="relative w-full overflow-hidden bg-zinc-50"
        style={{ aspectRatio: "4 / 5" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={alt}
          onError={(e) => {
            if (!fallback || e.currentTarget.src === fallback) return;
            e.currentTarget.src = fallback;
          }}
          className="absolute left-0 w-full max-w-none object-cover object-bottom"
          style={{
            top: `${-crop * 100}%`,
            height: `${(1 + crop) * 100}%`,
          }}
        />
      </div>
      <figcaption className="border-t border-zinc-100 px-3 py-2 text-center text-xs font-medium text-zinc-600">
        {caption}
      </figcaption>
    </figure>
  );
}

export function ScanMaskAnnotations({
  imageUrl,
  wrinkleMaskUrl,
  acneMaskUrl,
  wrinkleFallbackUrl,
  acneFallbackUrl,
  spatialOutputs: _spatialOutputs,
  regions,
  wrinklePoseLabel = "Wrinkle mask (smiling)",
  acnePoseLabel = "Acne objectness (centre)",
}: {
  imageUrl: string;
  wrinkleMaskUrl?: string;
  acneMaskUrl?: string;
  /** Shown if mask file is missing (e.g. old absolute localhost URL). */
  wrinkleFallbackUrl?: string;
  acneFallbackUrl?: string;
  wrinklePoseLabel?: string;
  acnePoseLabel?: string;
  spatialOutputs?: ScanSpatialOutputs;
  regions: ReportRegion[];
}) {
  const wrinkle = wrinkleMaskUrl?.trim() || "";
  const acne = acneMaskUrl?.trim() || "";
  const showDotMarkers =
    !wrinkle && !acne && regions.length > 0 && imageUrl?.trim();

  if (!wrinkle && !acne && !showDotMarkers) return null;

  return (
    <div className="mx-auto mt-8 max-w-2xl break-inside-avoid">
      {(wrinkle || acne) && (
        <div
          className={`mx-auto grid gap-4 ${
            wrinkle && acne ? "grid-cols-1 sm:grid-cols-2" : "max-w-[280px]"
          }`}
        >
          {wrinkle ? (
            <MaskPanel
              src={wrinkle}
              alt="Wrinkle mask overlay"
              caption={wrinklePoseLabel}
              fallbackSrc={wrinkleFallbackUrl}
            />
          ) : null}
          {acne ? (
            <MaskPanel
              src={acne}
              alt="Acne objectness overlay"
              caption={acnePoseLabel}
              fallbackSrc={acneFallbackUrl}
            />
          ) : null}
        </div>
      )}

      {showDotMarkers ? (
        <div className="mx-auto mt-6 max-w-[280px]">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-300/80">
            <img
              src={imageUrl}
              alt="Scan with highlighted areas"
              className="h-full w-full object-cover object-center"
            />
            {regions.map((r, i) => (
              <div
                key={`${r.issue}-${i}`}
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                style={{
                  left: `${r.coordinates.x}%`,
                  top: `${r.coordinates.y}%`,
                  backgroundColor: regionMarkerColor(r.issue),
                }}
                title={r.issue}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {DOT_MARKER_LEGEND.items.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-700"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
