"use client";

import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import {
  ACNE_MASK_COPY,
  COMBINED_OVERLAY_COPY,
  DOT_MARKER_LEGEND,
  SCAN_MASK_SECTION,
  WRINKLE_MASK_COPY,
} from "@/src/lib/scanMaskLabels";
import { OrientedReportImage } from "./OrientedReportImage";
import type { ReportRegion } from "./scanReportTypes";

function regionMarkerColor(issue: string): string {
  const x = issue.toLowerCase();
  if (x.includes("acne")) return "#dc2626";
  if (x.includes("wrinkle")) return "#7c3aed";
  return "#6b7280";
}

function MaskCaption({
  title,
  hint,
  tone,
}: {
  title: string;
  hint: string;
  tone: "violet" | "orange";
}) {
  const titleCls =
    tone === "violet" ? "text-violet-900" : "text-orange-900";
  return (
    <figcaption className="space-y-1 text-center">
      <p className={`text-sm font-bold ${titleCls}`}>{title}</p>
      <p className="text-xs leading-snug text-zinc-600">{hint}</p>
    </figcaption>
  );
}

export function ScanMaskAnnotations({
  imageUrl,
  overlayUrl,
  wrinkleMaskUrl,
  acneMaskUrl,
  spatialOutputs: _spatialOutputs,
  regions,
}: {
  imageUrl: string;
  overlayUrl?: string;
  wrinkleMaskUrl?: string;
  acneMaskUrl?: string;
  spatialOutputs?: ScanSpatialOutputs;
  regions: ReportRegion[];
}) {
  const overlay = overlayUrl?.trim() || "";
  const wrinkle = wrinkleMaskUrl?.trim() || "";
  const acne = acneMaskUrl?.trim() || "";
  const showDotMarkers =
    !overlay && !wrinkle && !acne && regions.length > 0 && imageUrl?.trim();

  if (!overlay && !wrinkle && !acne && !showDotMarkers) return null;

  return (
    <div className="mx-auto mt-10 max-w-2xl break-inside-avoid">
      <p className="text-center text-sm font-bold text-zinc-800">
        {SCAN_MASK_SECTION.title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-zinc-600">
        {SCAN_MASK_SECTION.intro}
      </p>

      {(wrinkle || acne) && (
        <div
          className={`mx-auto mt-5 grid gap-5 ${
            wrinkle && acne ? "sm:grid-cols-2" : "max-w-[300px]"
          }`}
        >
          {wrinkle ? (
            <figure className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-2 ring-violet-300/80">
                <OrientedReportImage
                  src={wrinkle}
                  alt={WRINKLE_MASK_COPY.title}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <MaskCaption
                tone="violet"
                title={WRINKLE_MASK_COPY.title}
                hint={WRINKLE_MASK_COPY.hint}
              />
            </figure>
          ) : null}
          {acne ? (
            <figure className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-2 ring-orange-300/80">
                <OrientedReportImage
                  src={acne}
                  alt={ACNE_MASK_COPY.title}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <MaskCaption
                tone="orange"
                title={ACNE_MASK_COPY.title}
                hint={ACNE_MASK_COPY.hint}
              />
            </figure>
          ) : null}
        </div>
      )}

      {overlay ? (
        <figure className="mx-auto mt-8 max-w-[340px]">
          <p className="text-center text-sm font-bold text-zinc-800">
            {COMBINED_OVERLAY_COPY.title}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-center text-xs leading-relaxed text-zinc-600">
            {COMBINED_OVERLAY_COPY.hint}
          </p>
          <div className="relative mt-3 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-300/80">
            <OrientedReportImage
              src={overlay}
              alt={COMBINED_OVERLAY_COPY.title}
              className="h-full w-full object-cover object-center"
            />
          </div>
        </figure>
      ) : null}

      {showDotMarkers ? (
        <div className="mx-auto mt-6 max-w-[300px]">
          <p className="mb-2 text-center text-xs font-semibold text-zinc-700">
            {DOT_MARKER_LEGEND.title}
          </p>
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
