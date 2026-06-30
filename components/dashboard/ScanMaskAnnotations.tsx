"use client";

import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import {
  legacyMaskTitleCropStyle,
  shouldCropLegacyMaskTitle,
  SCAN_MASK_FRAME_ASPECT_CSS,
} from "@/src/lib/maskImageCrop";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import {
  ACNE_MASK_PANEL_LABEL,
  DOT_MARKER_LEGEND,
  WRINKLE_MASK_PANEL_LABEL,
} from "@/src/lib/scanMaskLabels";
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
  maskExportVersion,
  stretch = false,
}: {
  src: string;
  alt: string;
  caption: string;
  fallbackSrc?: string;
  maskExportVersion?: number | null;
  /** Fill the frame (distort if needed) — wrinkle mask only. */
  stretch?: boolean;
}) {
  const displaySrc = publicFileDisplayUrl(src) ?? src;
  const fallback = fallbackSrc ? publicFileDisplayUrl(fallbackSrc) ?? fallbackSrc : "";
  const cropLegacyTitle = shouldCropLegacyMaskTitle(displaySrc, maskExportVersion);
  const fitClass = stretch ? "object-fill" : "object-cover";
  return (
    <figure className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80">
      <div
        className="relative w-full overflow-hidden bg-zinc-50"
        style={{ aspectRatio: SCAN_MASK_FRAME_ASPECT_CSS }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={alt}
          onError={(e) => {
            const el = e.currentTarget;
            if (el.dataset.maskFallback === "1") return;
            if (fallback && el.src !== fallback) {
              el.dataset.maskFallback = "1";
              el.src = fallback;
            }
          }}
          className={
            cropLegacyTitle
              ? undefined
              : `h-full w-full ${fitClass} object-center`
          }
          style={
            cropLegacyTitle
              ? { ...legacyMaskTitleCropStyle(), objectFit: stretch ? "fill" : "cover" }
              : undefined
          }
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
  wrinklePoseLabel = WRINKLE_MASK_PANEL_LABEL,
  acnePoseLabel = ACNE_MASK_PANEL_LABEL,
  maskExportVersion,
}: {
  imageUrl: string;
  wrinkleMaskUrl?: string;
  acneMaskUrl?: string;
  /** Shown if mask file is missing (e.g. old absolute localhost URL). */
  wrinkleFallbackUrl?: string;
  acneFallbackUrl?: string;
  wrinklePoseLabel?: string;
  acnePoseLabel?: string;
  maskExportVersion?: number | null;
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
              maskExportVersion={maskExportVersion}
            />
          ) : null}
          {acne ? (
            <MaskPanel
              src={acne}
              alt="Acne objectness overlay"
              caption={acnePoseLabel}
              fallbackSrc={acneFallbackUrl}
              maskExportVersion={maskExportVersion}
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
