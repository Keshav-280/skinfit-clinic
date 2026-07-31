"use client";

import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import {
  legacyMaskTitleCropStyle,
  scanMaskPanelAspectCss,
  shouldCropLegacyMaskTitle,
} from "@/src/lib/maskImageCrop";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import {
  ACNE_MASK_PANEL_LABEL,
  DOT_MARKER_LEGEND,
  WRINKLE_MASK_PANEL_LABEL,
} from "@/src/lib/scanMaskLabels";
import type { ReportRegion } from "./scanReportTypes";
import type { ConcernChipId } from "./ConcernChips";

function regionMarkerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  if (x.includes("pigment")) return "#F59E0B";
  return "#6b7280";
}

function regionMatchesConcern(
  issue: string,
  activeConcern: ConcernChipId
): boolean {
  if (activeConcern === "all") return true;
  const x = issue.toLowerCase();
  if (activeConcern === "acne") return x.includes("acne");
  if (activeConcern === "wrinkles") return x.includes("wrinkle");
  if (activeConcern === "pigmentation") return x.includes("pigment");
  if (activeConcern === "hydration") return x.includes("hydrat") || x.includes("dry");
  if (activeConcern === "texture") return x.includes("texture") || x.includes("pore");
  return false;
}

function MaskPanel({
  src,
  alt,
  caption,
  fallbackSrc,
  maskExportVersion,
  stretch = false,
  visible = true,
}: {
  src: string;
  alt: string;
  caption: string;
  fallbackSrc?: string;
  maskExportVersion?: number | null;
  /** Fill the frame (distort if needed) — wrinkle mask only. */
  stretch?: boolean;
  visible?: boolean;
}) {
  const displaySrc = publicFileDisplayUrl(src) ?? src;
  const fallback = fallbackSrc ? publicFileDisplayUrl(fallbackSrc) ?? fallbackSrc : "";
  const cropLegacyTitle = shouldCropLegacyMaskTitle(displaySrc, maskExportVersion);
  const fitClass = stretch ? "object-fill" : cropLegacyTitle ? "object-contain" : "object-cover";
  return (
    <figure
      className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80 transition-opacity duration-300 ease-out"
      style={{ opacity: visible ? 1 : 0.22 }}
    >
      <div
        className="relative w-full overflow-hidden bg-zinc-50"
        style={{ aspectRatio: scanMaskPanelAspectCss(cropLegacyTitle) }}
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

function OverlayMaskImage({
  src,
  alt,
  visible,
  maskExportVersion,
  blend = "screen",
}: {
  src: string;
  alt: string;
  visible: boolean;
  maskExportVersion?: number | null;
  blend?: "screen" | "multiply" | "normal";
}) {
  const displaySrc = publicFileDisplayUrl(src) ?? src;
  const cropLegacyTitle = shouldCropLegacyMaskTitle(displaySrc, maskExportVersion);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      aria-hidden={!visible}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ease-out"
      style={{
        opacity: visible ? 0.72 : 0,
        mixBlendMode: blend,
        ...(cropLegacyTitle ? legacyMaskTitleCropStyle() : null),
      }}
    />
  );
}

/**
 * Face-photo overlay for the immersive ScanViewer — fades masks by active concern.
 */
export function ScanFaceOverlay({
  imageUrl: _imageUrl,
  wrinkleMaskUrl,
  acneMaskUrl,
  maskExportVersion,
  spatialOutputs: _spatialOutputs,
  regions,
  activeConcern = "all",
}: {
  imageUrl: string;
  wrinkleMaskUrl?: string;
  acneMaskUrl?: string;
  maskExportVersion?: number | null;
  spatialOutputs?: ScanSpatialOutputs;
  regions: ReportRegion[];
  activeConcern?: ConcernChipId;
}) {
  const wrinkle = wrinkleMaskUrl?.trim() || "";
  const acne = acneMaskUrl?.trim() || "";
  const showWrinkle =
    Boolean(wrinkle) &&
    (activeConcern === "all" || activeConcern === "wrinkles");
  const showAcne =
    Boolean(acne) && (activeConcern === "all" || activeConcern === "acne");
  const showPigmentTint = activeConcern === "pigmentation";
  const showDots =
    regions.length > 0 &&
    (activeConcern === "all" ||
      activeConcern === "pigmentation" ||
      activeConcern === "acne" ||
      activeConcern === "wrinkles" ||
      activeConcern === "hydration" ||
      activeConcern === "texture");

  const hasAny = wrinkle || acne || regions.length > 0;
  if (!hasAny) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {wrinkle ? (
        <OverlayMaskImage
          src={wrinkle}
          alt=""
          visible={showWrinkle}
          maskExportVersion={maskExportVersion}
          blend="screen"
        />
      ) : null}
      {acne ? (
        <OverlayMaskImage
          src={acne}
          alt=""
          visible={showAcne}
          maskExportVersion={maskExportVersion}
          blend="screen"
        />
      ) : null}

      {/* Soft amber wash when focusing pigmentation (no dedicated pigment mask). */}
      <div
        className="absolute inset-0 transition-opacity duration-300 ease-out"
        style={{
          opacity: showPigmentTint ? 0.28 : 0,
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.45) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      {showDots
        ? regions.map((r, i) => {
            const visible = regionMatchesConcern(r.issue, activeConcern);
            return (
              <div
                key={`${r.issue}-${i}`}
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-opacity duration-300 ease-out"
                style={{
                  left: `${r.coordinates.x}%`,
                  top: `${r.coordinates.y}%`,
                  backgroundColor: regionMarkerColor(r.issue),
                  opacity: visible ? 1 : 0,
                }}
                title={r.issue}
              />
            );
          })
        : null}

      <div
        className="absolute inset-0 transition-opacity duration-300 ease-out"
        style={{
          opacity:
            activeConcern === "hydration" || activeConcern === "texture"
              ? 0.12
              : 0,
          background: "rgba(15,23,42,0.35)",
        }}
        aria-hidden
      />
    </div>
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
  activeConcern = "all",
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
  /** When set, dims non-matching mask panels (PDF / legacy gallery). */
  activeConcern?: ConcernChipId;
}) {
  const wrinkle = wrinkleMaskUrl?.trim() || "";
  const acne = acneMaskUrl?.trim() || "";
  const showDotMarkers =
    !wrinkle && !acne && regions.length > 0 && imageUrl?.trim();

  const wrinkleVisible =
    activeConcern === "all" || activeConcern === "wrinkles";
  const acneVisible = activeConcern === "all" || activeConcern === "acne";

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
              visible={wrinkleVisible}
            />
          ) : null}
          {acne ? (
            <MaskPanel
              src={acne}
              alt="Acne objectness overlay"
              caption={acnePoseLabel}
              fallbackSrc={acneFallbackUrl}
              maskExportVersion={maskExportVersion}
              visible={acneVisible}
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
            {regions.map((r, i) => {
              const visible = regionMatchesConcern(r.issue, activeConcern);
              return (
                <div
                  key={`${r.issue}-${i}`}
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-opacity duration-300 ease-out"
                  style={{
                    left: `${r.coordinates.x}%`,
                    top: `${r.coordinates.y}%`,
                    backgroundColor: regionMarkerColor(r.issue),
                    opacity: visible ? 1 : 0,
                  }}
                  title={r.issue}
                />
              );
            })}
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
